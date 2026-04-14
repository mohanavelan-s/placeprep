const { randomUUID } = require('crypto');

const env = require('../config/env');
const deliveryJobRepository = require('../repositories/deliveryJob.repository');
const notificationRepository = require('../repositories/notification.repository');
const { sendAdminAssignmentEmail, sendNotificationDigestEmail } = require('./email.service');
const { sendPushNotificationToUser } = require('./webPush.service');

const workerId = `delivery-worker-${process.pid}-${randomUUID().slice(0, 8)}`;
let processingPromise = null;
let scheduledRun = null;

function isSchemaNotReadyError(error) {
  return ['42P01', '42703', '42P10'].includes(String(error?.code || ''));
}

function buildRetryDelay(job) {
  const attempt = Math.max(Number(job?.attempts || 1), 1);
  const delayMs = Math.min(30 * 60 * 1000, 60 * 1000 * (2 ** (attempt - 1)));
  return new Date(Date.now() + delayMs);
}

function scheduleDeliveryProcessing(delayMs = 250) {
  if (!env.deliveryWorkerEnabled || scheduledRun || processingPromise) {
    return;
  }

  scheduledRun = setTimeout(() => {
    scheduledRun = null;
    void processPendingDeliveryJobs().catch((error) => {
      if (isSchemaNotReadyError(error)) {
        console.error('[delivery] Queue tables are not ready yet. Skipping queued delivery startup run.');
        return;
      }

      console.error('[delivery] Startup queue run failed.', error);
    });
  }, delayMs);
}

async function enqueueNotificationDigestEmail(payload) {
  const job = await deliveryJobRepository.createJob({
    type: 'notification_digest_email',
    dedupeKey: payload.dedupeKey,
    payload,
    maxAttempts: 5,
  });

  scheduleDeliveryProcessing();
  return job;
}

async function enqueueAdminAssignmentEmail(payload) {
  const job = await deliveryJobRepository.createJob({
    type: 'admin_assignment_email',
    dedupeKey: payload.dedupeKey,
    payload,
    maxAttempts: 5,
  });

  scheduleDeliveryProcessing();
  return job;
}

async function enqueueNotificationPush(payload) {
  const job = await deliveryJobRepository.createJob({
    type: 'web_push_notification',
    dedupeKey: payload.dedupeKey,
    payload,
    maxAttempts: 4,
  });

  scheduleDeliveryProcessing();
  return job;
}

async function handleNotificationDigestJob(job) {
  const payload = job.payload || {};
  const emailResult = await sendNotificationDigestEmail({
    user: payload.user,
    notifications: payload.notifications,
    summary: payload.summary,
    context: payload.context,
  });

  if (!emailResult.sent) {
    throw new Error(emailResult.reason || 'notification_digest_email_failed');
  }

  const notificationIds = (payload.notifications || []).map((notification) => notification.id).filter(Boolean);
  if (notificationIds.length) {
    await notificationRepository.markEmailed(notificationIds);
  }
}

async function handleAdminAssignmentJob(job) {
  const payload = job.payload || {};
  const emailResult = await sendAdminAssignmentEmail({
    user: payload.user,
    assignment: payload.assignment,
  });

  if (!emailResult.sent) {
    throw new Error(emailResult.reason || 'admin_assignment_email_failed');
  }

  if (payload.notificationId) {
    await notificationRepository.markEmailed([payload.notificationId]);
  }
}

async function handleWebPushJob(job) {
  const payload = job.payload || {};
  const pushResult = await sendPushNotificationToUser({
    userId: payload.userId,
    notification: payload.notification,
  });

  if (pushResult.failedCount && !pushResult.sentCount) {
    throw new Error(pushResult.reason || 'web_push_delivery_failed');
  }
}

async function processJob(job) {
  if (job.type === 'notification_digest_email') {
    await handleNotificationDigestJob(job);
    return;
  }

  if (job.type === 'admin_assignment_email') {
    await handleAdminAssignmentJob(job);
    return;
  }

  if (job.type === 'web_push_notification') {
    await handleWebPushJob(job);
    return;
  }

  throw new Error(`Unsupported delivery job type: ${job.type}`);
}

async function processPendingDeliveryJobs(limit = env.deliveryWorkerBatchSize) {
  if (!env.deliveryWorkerEnabled) {
    return {
      processed: 0,
    };
  }

  if (processingPromise) {
    return processingPromise;
  }

  processingPromise = (async () => {
    let processed = 0;

    while (true) {
      let jobs = [];
      try {
        jobs = await deliveryJobRepository.claimJobs(limit, workerId);
      } catch (error) {
        if (isSchemaNotReadyError(error)) {
          console.error('[delivery] Queue tables are not ready yet. Delivery worker is staying idle.');
          break;
        }

        throw error;
      }

      if (!jobs.length) {
        break;
      }

      for (const job of jobs) {
        try {
          await processJob(job);
          await deliveryJobRepository.completeJob(job.id);
          processed += 1;
        } catch (error) {
          console.error(`[delivery] Job ${job.id} failed.`, error);
          await deliveryJobRepository.releaseJob(
            job.id,
            error?.message || 'delivery_job_failed',
            buildRetryDelay(job),
          );
        }
      }
    }

    return {
      processed,
    };
  })().finally(() => {
    processingPromise = null;
  });

  return processingPromise;
}

module.exports = {
  enqueueNotificationDigestEmail,
  enqueueAdminAssignmentEmail,
  enqueueNotificationPush,
  scheduleDeliveryProcessing,
  processPendingDeliveryJobs,
};
