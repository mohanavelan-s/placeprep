import {
  deletePushSubscription,
  fetchWebPushConfig,
  savePushSubscription,
} from "@/lib/api";

export interface BrowserPushSyncResult {
  active: boolean;
  permission: NotificationPermission | "unsupported";
  endpoint?: string;
  reason?: string;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

export function getBrowserPushSupport() {
  if (typeof window === "undefined") {
    return {
      supported: false,
      reason: "window_unavailable",
    };
  }

  if (!("Notification" in window)) {
    return {
      supported: false,
      reason: "notification_api_unavailable",
    };
  }

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return {
      supported: false,
      reason: "push_api_unavailable",
    };
  }

  return {
    supported: true,
    reason: "supported",
  };
}

export async function syncBrowserPushSubscription({
  enabled,
  requestPermission = false,
}: {
  enabled: boolean;
  requestPermission?: boolean;
}): Promise<BrowserPushSyncResult> {
  const support = getBrowserPushSupport();
  if (!support.supported) {
    return {
      active: false,
      permission: "unsupported",
      reason: support.reason,
    };
  }

  const registration = await navigator.serviceWorker.register("/push-sw.js");
  const existingSubscription = await registration.pushManager.getSubscription();
  let permission = window.Notification.permission;

  if (enabled && permission === "default" && requestPermission) {
    permission = await window.Notification.requestPermission();
  }

  if (!enabled || permission !== "granted") {
    if (existingSubscription) {
      await deletePushSubscription(existingSubscription.endpoint).catch((error) => {
        console.error("[browser-push] Failed to delete stored push subscription.", error);
      });
      await existingSubscription.unsubscribe().catch((error) => {
        console.error("[browser-push] Failed to unsubscribe browser push.", error);
      });
    }

    return {
      active: false,
      permission,
      reason: permission === "granted" ? "disabled" : "permission_not_granted",
    };
  }

  const config = await fetchWebPushConfig();
  if (!config.enabled || !config.publicKey) {
    return {
      active: false,
      permission,
      reason: "web_push_not_configured",
    };
  }

  const subscription = existingSubscription || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(config.publicKey),
  });

  const subscriptionJson = subscription.toJSON();
  if (
    !subscriptionJson.endpoint
    || !subscriptionJson.keys?.p256dh
    || !subscriptionJson.keys?.auth
  ) {
    return {
      active: false,
      permission,
      reason: "invalid_subscription",
    };
  }

  await savePushSubscription({
    subscription: {
      endpoint: subscriptionJson.endpoint,
      expirationTime: subscriptionJson.expirationTime ?? null,
      keys: {
        p256dh: subscriptionJson.keys.p256dh,
        auth: subscriptionJson.keys.auth,
      },
    },
  });

  return {
    active: true,
    permission,
    endpoint: subscription.endpoint,
    reason: "subscribed",
  };
}
