import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { useQueryErrorLogger } from "@/hooks/use-query-error-logger";
import {
  deletePushSubscription,
  fetchNotifications,
  fetchWebPushConfig,
  fetchUserProfile,
  markNotificationRead,
  savePushSubscription,
  syncNotifications,
  type PrepNotification,
  type NotificationType,
} from "@/lib/api";

const titleMap: Record<NotificationType, string> = {
  coach_capsule: "New admin assignment",
  countdown_urgency: "Deadline pressure",
  daily_inactivity: "Return to command",
  missed_streak: "Streak warning",
  motivation: "Nocturne push",
  pending_tasks: "Pending tasks",
};

const routeMap: Partial<Record<NotificationType, string>> = {
  coach_capsule: "/tasks",
  countdown_urgency: "/dashboard",
  daily_inactivity: "/dashboard",
  missed_streak: "/progress",
  motivation: "/dashboard",
  pending_tasks: "/tasks",
};

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

async function syncPushSubscription(enabled: boolean) {
  if (
    typeof window === "undefined"
    || !("serviceWorker" in navigator)
    || !("PushManager" in window)
  ) {
    return {
      active: false,
    };
  }

  const registration = await navigator.serviceWorker.register("/push-sw.js");
  const existingSubscription = await registration.pushManager.getSubscription();

  if (!enabled || window.Notification.permission !== "granted") {
    if (existingSubscription) {
      await deletePushSubscription(existingSubscription.endpoint).catch((error) => {
        console.error("[BrowserNotificationBridge] Failed to delete push subscription.", error);
      });
      await existingSubscription.unsubscribe().catch((error) => {
        console.error("[BrowserNotificationBridge] Failed to unsubscribe browser push.", error);
      });
    }

    return {
      active: false,
    };
  }

  const config = await fetchWebPushConfig();
  if (!config.enabled || !config.publicKey) {
    return {
      active: false,
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
    endpoint: subscription.endpoint,
  };
}

export default function BrowserNotificationBridge() {
  const shownIdsRef = useRef<Set<string>>(new Set());
  const profileQuery = useQuery({
    queryKey: ["user-profile"],
    queryFn: fetchUserProfile,
  });

  useQueryErrorLogger("BrowserNotificationBridge:user-profile", profileQuery.error);

  const notificationsEnabled = profileQuery.data?.notificationsEnabled ?? false;
  const browserEnabled = profileQuery.data?.notificationBrowserEnabled ?? false;
  const browserPermission = profileQuery.data?.notificationBrowserPermission ?? "default";

  useEffect(() => {
    try {
      const savedIds = window.sessionStorage.getItem("placeprep.browserNotifications.seen");
      if (!savedIds) {
        return;
      }

      const parsedIds = JSON.parse(savedIds);
      if (Array.isArray(parsedIds)) {
        shownIdsRef.current = new Set(parsedIds.filter((value) => typeof value === "string"));
      }
    } catch (error) {
      console.error("[BrowserNotificationBridge] Failed to restore shown notification ids.", error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      console.error("[BrowserNotificationBridge] Notification API is not available in this browser.");
      return;
    }

    let cancelled = false;

    function persistShownIds() {
      try {
        window.sessionStorage.setItem(
          "placeprep.browserNotifications.seen",
          JSON.stringify(Array.from(shownIdsRef.current)),
        );
      } catch (error) {
        console.error("[BrowserNotificationBridge] Failed to persist shown notification ids.", error);
      }
    }

    function dispatchBrowserNotification(item: PrepNotification) {
      if (shownIdsRef.current.has(item.id)) {
        return;
      }

      shownIdsRef.current.add(item.id);
      persistShownIds();

      const notificationTitle =
        typeof item.metadata?.title === "string" && item.metadata.title.trim()
          ? item.metadata.title
          : titleMap[item.type];

      const browserNotification = new window.Notification(notificationTitle, {
        body: item.message,
        icon: "/favicon.svg",
        tag: item.id,
      });

      browserNotification.onclick = () => {
        window.focus();
        const route =
          typeof item.metadata?.route === "string" && item.metadata.route.trim()
            ? item.metadata.route
            : routeMap[item.type];
        if (route) {
          window.location.assign(route);
        }

        void markNotificationRead(item.id).catch((error) => {
          console.error("[BrowserNotificationBridge] Failed to mark notification as read.", error);
        });

        browserNotification.close();
      };
    }

    async function runSync() {
      try {
        const pushState = await syncPushSubscription(
          notificationsEnabled && browserEnabled && browserPermission === "granted",
        );

        if (cancelled) {
          return;
        }

        if (!notificationsEnabled || !browserEnabled || window.Notification.permission !== "granted") {
          return;
        }

        const [result, unreadNotifications] = await Promise.all([
          syncNotifications(),
          fetchNotifications({ unread: true, limit: 6 }),
        ]);

        if (cancelled) {
          return;
        }

        const notificationsToShow = [...result.created, ...unreadNotifications]
          .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
          .slice(0, 3);

        if (!pushState.active) {
          notificationsToShow.forEach(dispatchBrowserNotification);
        }
      } catch (error) {
        console.error("[BrowserNotificationBridge] Notification sync threw an exception.", error);
      }
    }

    void runSync();

    return () => {
      cancelled = true;
    };
  }, [
    browserPermission,
    browserEnabled,
    notificationsEnabled,
  ]);

  return null;
}
