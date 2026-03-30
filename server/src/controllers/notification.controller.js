const notificationService = require('../services/notification.service');

async function listNotifications(req, res) {
  const notifications = await notificationService.listNotificationsForUser(req.user, {
    unreadOnly: req.query.unread === true || req.query.unread === 'true',
    limit: req.query.limit,
  });

  res.json({
    success: true,
    data: notifications,
  });
}

async function syncNotifications(req, res) {
  const result = await notificationService.syncNotificationsForUser(req.user, {
    source: 'app_sync',
    deliverEmail: req.body?.deliverEmail === true || req.query?.deliverEmail === 'true',
  });

  res.json({
    success: true,
    data: result,
  });
}

async function markRead(req, res) {
  const notification = await notificationService.markNotificationRead(
    req.user,
    req.params.notificationId,
  );

  res.json({
    success: true,
    data: notification,
  });
}

async function markAllRead(req, res) {
  const result = await notificationService.markAllNotificationsRead(req.user);

  res.json({
    success: true,
    data: result,
  });
}

module.exports = {
  listNotifications,
  syncNotifications,
  markRead,
  markAllRead,
};
