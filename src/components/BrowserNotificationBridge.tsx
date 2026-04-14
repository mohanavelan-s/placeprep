import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { useQueryErrorLogger } from "@/hooks/use-query-error-logger";
import {
  fetchNotifications,
  fetchUserProfile,
  markNotificationRead,
  syncNotifications,
  type PrepNotification,
  type NotificationType,
} from "@/lib/api";

const titleMap: Record<NotificationType, string> = {
  coach_capsule: "New practice capsule",
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

export default function BrowserNotificationBridge() {
  const shownIdsRef = useRef<Set<string>>(new Set());
  const profileQuery = useQuery({
    queryKey: ["user-profile"],
    queryFn: fetchUserProfile,
  });

  useQueryErrorLogger("BrowserNotificationBridge:user-profile", profileQuery.error);

  const notificationsEnabled = profileQuery.data?.notificationsEnabled ?? false;
  const browserEnabled = profileQuery.data?.notificationBrowserEnabled ?? false;

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
    if (!notificationsEnabled || !browserEnabled) {
      return;
    }

    if (typeof window === "undefined" || !("Notification" in window)) {
      console.error("[BrowserNotificationBridge] Notification API is not available in this browser.");
      return;
    }

    if (window.Notification.permission !== "granted") {
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

        notificationsToShow.forEach(dispatchBrowserNotification);
      } catch (error) {
        console.error("[BrowserNotificationBridge] Notification sync threw an exception.", error);
      }
    }

    void runSync();

    return () => {
      cancelled = true;
    };
  }, [
    browserEnabled,
    notificationsEnabled,
  ]);

  return null;
}
