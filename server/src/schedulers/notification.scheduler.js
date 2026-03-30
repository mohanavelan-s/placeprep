const cron = require('node-cron');
const env = require('../config/env');
const { runDailySweep } = require('../services/notification.service');

let notificationTask = null;

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
      env.notificationCron,
      async () => {
        try {
          const result = await runDailySweep();
          console.log(
            `[notifications] Sweep complete. users=${result.scannedUsers} created=${result.createdCount} emails=${result.emailSentCount}`,
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

    console.log(`[notifications] Scheduler armed on "${env.notificationCron}" (${env.defaultTimezone}).`);
  } catch (error) {
    console.error('[notifications] Scheduler could not start.', error);
  }

  return notificationTask;
}

module.exports = {
  startNotificationScheduler,
};
