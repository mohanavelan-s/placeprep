const cron = require('node-cron');
const env = require('../config/env');
const { processPendingDeliveryJobs, scheduleDeliveryProcessing } = require('../services/deliveryJob.service');
const { runDailySweep } = require('../services/notification.service');

let notificationTask = null;
let deliveryTask = null;

function startNotificationScheduler() {
  if (!env.notificationSchedulerEnabled || env.nodeEnv === 'test') {
    console.log('[notifications] Daily scheduler disabled.');
    return null;
  }

  if (notificationTask) {
    return notificationTask;
  }

  try {
    notificationTask = cron.schedule(
      env.notificationSweepCron,
      async () => {
        try {
          const result = await runDailySweep();
          console.log(
            `[notifications] Sweep complete. users=${result.scannedUsers} created=${result.createdCount} sent=${result.emailSentCount} queued=${result.emailQueuedCount || 0}`,
          );
        } catch (error) {
          console.error('[notifications] Sweep failed.', error);
        }
      },
      {
        scheduled: true,
        timezone: env.defaultTimezone,
      }
    );

    console.log(
      `[notifications] Scheduler armed on "${env.notificationSweepCron}" (${env.defaultTimezone}) with morning=${env.notificationMorningHour}:00 evening=${env.notificationEveningHour}:00.`,
    );

    if (env.deliveryWorkerEnabled) {
      deliveryTask = cron.schedule(
        env.deliveryWorkerCron,
        async () => {
          try {
            const result = await processPendingDeliveryJobs();
            if (result.processed) {
              console.log(`[delivery] Processed ${result.processed} queued email job(s).`);
            }
          } catch (error) {
            console.error('[delivery] Queue drain failed.', error);
          }
        },
        {
          scheduled: true,
          timezone: env.defaultTimezone,
        }
      );

      console.log(`[delivery] Worker armed on "${env.deliveryWorkerCron}" (${env.defaultTimezone}).`);
      scheduleDeliveryProcessing(1000);
    } else {
      console.log('[delivery] Queue worker disabled.');
    }
  } catch (error) {
    console.error('[notifications] Scheduler could not start.', error);
  }

  return notificationTask;
}

module.exports = {
  startNotificationScheduler,
};
