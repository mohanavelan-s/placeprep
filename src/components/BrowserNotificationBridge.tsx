import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { useQueryErrorLogger } from "@/hooks/use-query-error-logger";
import {
  fetchUserProfile,
  markNotificationRead,
  syncNotifications,
  type NotificationType,
} from "@/lib/api";

const titleMap: Record<NotificationType, string> = {
  countdown_urgency: "Deadline pressure",
  daily_inactivity: "Return to command",
  missed_streak: "Streak warning",
  motivation: "Nocturne push",
  pending_tasks: "Pending tasks",
};

const routeMap: Partial<Record<NotificationType, string>> = {
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

    async function runSync() {
      try {
        const result = await syncNotifications();
        if (cancelled) {
          return;
        }

        result.created.forEach((item) => {
          if (shownIdsRef.current.has(item.id)) {
            return;
          }

          shownIdsRef.current.add(item.id);
          const browserNotification = new window.Notification(titleMap[item.type], {
            body: item.message,
            icon: "/favicon.svg",
            tag: item.id,
          });

          browserNotification.onclick = () => {
            window.focus();
            const route = routeMap[item.type];
            if (route) {
              window.location.assign(route);
            }

            void markNotificationRead(item.id).catch((error) => {
              console.error("[BrowserNotificationBridge] Failed to mark notification as read.", error);
            });

            browserNotification.close();
          };
        });
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
