const webPush = require('web-push');

const env = require('../config/env');
const appSettingRepository = require('../repositories/appSetting.repository');
const pushSubscriptionRepository = require('../repositories/pushSubscription.repository');

const settingKey = 'web_push_vapid_keys';
let cachedVapidKeys = null;

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function toNotificationTitle(notification) {
  return compactText(notification?.metadata?.title || 'PlacePrep');
}

function toNotificationRoute(notification) {
  const route = compactText(notification?.metadata?.route || '/tasks');
  return route.startsWith('http')
    ? route
    : `${String(env.clientUrl || '').replace(/\/$/, '')}${route.startsWith('/') ? route : `/${route}`}`;
}

async function resolveVapidKeys() {
  if (cachedVapidKeys) {
    return cachedVapidKeys;
  }

  if (env.webPushPublicKey && env.webPushPrivateKey) {
    cachedVapidKeys = {
      publicKey: env.webPushPublicKey,
      privateKey: env.webPushPrivateKey,
    };
    return cachedVapidKeys;
  }

  const existing = await appSettingRepository.findByKey(settingKey);
  const storedPublicKey = existing?.value?.publicKey;
  const storedPrivateKey = existing?.value?.privateKey;

  if (storedPublicKey && storedPrivateKey) {
    cachedVapidKeys = {
      publicKey: storedPublicKey,
      privateKey: storedPrivateKey,
    };
    return cachedVapidKeys;
  }

  const generated = webPush.generateVAPIDKeys();
  await appSettingRepository.upsertSetting(settingKey, generated);
  cachedVapidKeys = generated;
  return generated;
}

async function getWebPushConfig() {
  const vapidKeys = await resolveVapidKeys();

  return {
    enabled: Boolean(vapidKeys?.publicKey && vapidKeys?.privateKey),
    publicKey: vapidKeys?.publicKey || '',
  };
}

async function getWebPushClient() {
  const vapidKeys = await resolveVapidKeys();

  try {
    webPush.setVapidDetails(
      env.webPushSubject,
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );
  } catch (error) {
    console.error(`[push] Invalid VAPID subject "${env.webPushSubject}". Falling back to mailto:support@placeprep.app.`, error);
    webPush.setVapidDetails(
      'mailto:support@placeprep.app',
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );
  }

  return webPush;
}

function normalizeSubscriptionPayload(subscription, userAgent) {
  const endpoint = compactText(subscription?.endpoint);
  const p256dh = compactText(subscription?.keys?.p256dh);
  const auth = compactText(subscription?.keys?.auth);
  const expirationTime = subscription?.expirationTime
    ? new Date(Number(subscription.expirationTime)).toISOString()
    : null;

  if (!endpoint || !p256dh || !auth) {
    return null;
  }

  return {
    endpoint,
    p256dh,
    auth,
    expirationTime,
    userAgent: compactText(userAgent) || null,
    metadata: {},
  };
}

async function saveSubscription(user, subscription, userAgent) {
  const normalized = normalizeSubscriptionPayload(subscription, userAgent);
  if (!normalized) {
    return null;
  }

  return pushSubscriptionRepository.upsertSubscription({
    userId: user.id,
    ...normalized,
  });
}

async function removeSubscription(user, endpoint) {
  return pushSubscriptionRepository.deleteByEndpoint(user.id, endpoint);
}

async function listSubscriptions(user) {
  return pushSubscriptionRepository.listByUserId(user.id);
}

function buildPushPayload(notification) {
  return {
    title: toNotificationTitle(notification),
    body: compactText(notification?.message || 'PlacePrep signal'),
    icon: '/favicon.svg',
    tag: notification?.id || undefined,
    data: {
      route: toNotificationRoute(notification),
      notificationId: notification?.id || null,
    },
  };
}

function shouldRemoveSubscription(error) {
  return Number(error?.statusCode) === 404 || Number(error?.statusCode) === 410;
}

async function sendPushNotificationToUser({ userId, notification }) {
  const subscriptions = await pushSubscriptionRepository.listByUserId(userId);
  if (!subscriptions.length) {
    return {
      attempted: false,
      sentCount: 0,
      failedCount: 0,
      reason: 'no_subscriptions',
    };
  }

  const client = await getWebPushClient();
  const payload = JSON.stringify(buildPushPayload(notification));
  let sentCount = 0;
  let failedCount = 0;

  await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await client.sendNotification(
          {
            endpoint: subscription.endpoint,
            expirationTime: subscription.expirationTime,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload,
          {
            TTL: 120,
            urgency: 'high',
          }
        );

        sentCount += 1;
        await pushSubscriptionRepository.touchSubscription(subscription.endpoint);
      } catch (error) {
        failedCount += 1;
        if (shouldRemoveSubscription(error)) {
          await pushSubscriptionRepository.deleteByEndpointAnyUser(subscription.endpoint);
        } else {
          console.error('[push] Failed to deliver web push notification.', error);
        }
      }
    })
  );

  return {
    attempted: true,
    sentCount,
    failedCount,
    reason: sentCount ? 'sent' : 'delivery_failed',
  };
}

module.exports = {
  getWebPushConfig,
  saveSubscription,
  removeSubscription,
  listSubscriptions,
  sendPushNotificationToUser,
};
