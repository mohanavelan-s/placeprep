import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BellRing,
  CheckCheck,
  Clock3,
  ExternalLink,
  Loader2,
  Mail,
  Monitor,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import ClearHistoryButton from "@/components/ClearHistoryButton";
import PageStatusPanel from "@/components/PageStatusPanel";
import SoftSyncNotice from "@/components/SoftSyncNotice";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useQueryErrorLogger } from "@/hooks/use-query-error-logger";
import { syncBrowserPushSubscription } from "@/lib/browser-push";
import {
  clearNotificationHistory,
  fetchNotifications,
  fetchUserProfile,
  markAllNotificationsRead,
  markNotificationRead,
  saveUserProfile,
  syncNotifications,
  testPushNotification,
  type NotificationSyncResult,
  type PrepNotification,
  type UserProfile,
} from "@/lib/api";
import { isPlacePrepAndroidApp } from "@/lib/platform";

type FilterMode = "all" | "unread";

function notificationLabel(notification: PrepNotification) {
  if (notification.type === "test_notification" || notification.metadata?.source === "manual_push_test") {
    return "Test signal";
  }

  switch (notification.type) {
    case "coach_capsule":
      return "Admin assignment";
    case "countdown_urgency":
      return "Deadline";
    case "daily_inactivity":
      return "Inactivity";
    case "missed_streak":
      return "Streak";
    case "pending_tasks":
      return "Tasks";
    default:
      return "Motivation";
  }
}

function notificationRoute(notification: PrepNotification) {
  const route = notification.metadata?.route;
  if (typeof route === "string" && route.trim()) {
    return route;
  }

  switch (notification.type) {
    case "coach_capsule":
    case "pending_tasks":
      return "/tasks";
    case "missed_streak":
      return "/progress";
    case "test_notification":
      return "/notifications";
    default:
      return "/dashboard";
  }
}

function formatTime(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function reasonLabel(value?: string | null) {
  const map: Record<string, string> = {
    already_emailed: "already delivered",
    browser_notifications_disabled: "browser off",
    browser_permission_not_granted: "permission needed",
    delivery_failed: "delivery failed",
    delivery_skipped: "in-app only",
    disabled: "disabled",
    email_disabled: "email off",
    email_not_configured: "email not configured",
    email_notifications_disabled: "email off",
    notifications_disabled: "notifications off",
    outside_window: "outside schedule",
    permission_not_granted: "permission needed",
    queued: "queued",
    sent: "sent",
    subscribed: "subscribed",
    web_push_not_configured: "push not configured",
  };

  return map[String(value || "")] || String(value || "ready").replace(/_/g, " ");
}

function buildProfilePayload(profile?: UserProfile | null, overrides: Partial<UserProfile> = {}) {
  const next = { ...profile, ...overrides };

  return {
    linkedinUrl: next.linkedinUrl || "",
    githubUrl: next.githubUrl || "",
    leetcodeUrl: next.leetcodeUrl || "",
    portfolioUrl: next.portfolioUrl || "",
    resumeUrl: next.resumeUrl || "",
    avatarUrl: next.avatarUrl || "",
    notificationsEnabled: next.notificationsEnabled ?? true,
    notificationEmailEnabled: next.notificationEmailEnabled ?? true,
    notificationBrowserEnabled: next.notificationBrowserEnabled ?? false,
    notificationBrowserPermission: next.notificationBrowserPermission || "default",
  };
}

function getNotificationDefaults(profile?: UserProfile | null) {
  return {
    notificationsEnabled: profile?.notificationsEnabled ?? true,
    notificationEmailEnabled: profile?.notificationEmailEnabled ?? true,
    notificationBrowserEnabled: profile?.notificationBrowserEnabled ?? false,
    notificationBrowserPermission: profile?.notificationBrowserPermission ?? "default",
  };
}

function DeliveryStatus({ syncResult }: { syncResult: NotificationSyncResult | null }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div className="rounded-[1rem] border border-border/80 bg-background/55 px-4 py-3">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">In-app</p>
        <p className="mt-2 text-lg text-foreground">Live</p>
      </div>
      <div className="rounded-[1rem] border border-border/80 bg-background/55 px-4 py-3">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Email</p>
        <p className="mt-2 text-lg text-foreground">
          {syncResult?.emailSent ? "Sent" : reasonLabel(syncResult?.emailReason)}
        </p>
      </div>
      <div className="rounded-[1rem] border border-border/80 bg-background/55 px-4 py-3">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">New pulse</p>
        <p className="mt-2 text-lg text-foreground">{syncResult?.created?.length ?? 0} signals</p>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const autoPulseRef = useRef(false);
  const runningInsideAndroidApp = isPlacePrepAndroidApp();
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [syncResult, setSyncResult] = useState<NotificationSyncResult | null>(null);
  const [prefs, setPrefs] = useState(getNotificationDefaults());

  const profileQuery = useQuery({
    queryKey: ["user-profile"],
    queryFn: fetchUserProfile,
  });
  const notificationsQuery = useQuery({
    queryKey: ["notifications", filterMode],
    queryFn: () => fetchNotifications({ unread: filterMode === "unread", limit: 40 }),
    refetchInterval: 30_000,
  });

  useQueryErrorLogger("NotificationsPage:profile", profileQuery.error);
  useQueryErrorLogger("NotificationsPage:notifications", notificationsQuery.error);

  useEffect(() => {
    setPrefs(getNotificationDefaults(profileQuery.data));
  }, [profileQuery.data]);

  const unreadCount = useMemo(
    () => (notificationsQuery.data || []).filter((notification) => !notification.read).length,
    [notificationsQuery.data],
  );

  const syncMutation = useMutation({
    mutationFn: (payload?: { deliverEmail?: boolean }) => syncNotifications(payload),
    onSuccess: async (result) => {
      setSyncResult(result);
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      if (result.created.length) {
        toast.success(`${result.created.length} live signal${result.created.length === 1 ? "" : "s"} generated.`);
      } else {
        toast.success("Notification pulse checked.");
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to sync notifications.");
    },
  });

  useEffect(() => {
    if (autoPulseRef.current || profileQuery.isPending) {
      return;
    }

    autoPulseRef.current = true;
    syncMutation.mutate({ deliverEmail: false });
  }, [profileQuery.isPending, syncMutation]);

  const savePrefsMutation = useMutation({
    mutationFn: async () => {
      let nextBrowserPermission = prefs.notificationBrowserPermission;
      let nextBrowserEnabled = runningInsideAndroidApp ? false : prefs.notificationBrowserEnabled;

      if (prefs.notificationsEnabled && nextBrowserEnabled) {
        const pushState = await syncBrowserPushSubscription({
          enabled: true,
          requestPermission: true,
        });
        nextBrowserPermission = pushState.permission === "unsupported" ? "denied" : pushState.permission;
        nextBrowserEnabled = pushState.active;
      } else {
        await syncBrowserPushSubscription({ enabled: false }).catch(() => undefined);
      }

      return saveUserProfile(buildProfilePayload(profileQuery.data, {
        notificationsEnabled: prefs.notificationsEnabled,
        notificationEmailEnabled: prefs.notificationEmailEnabled,
        notificationBrowserEnabled: nextBrowserEnabled,
        notificationBrowserPermission: nextBrowserPermission,
      }));
    },
    onSuccess: async (profile) => {
      setPrefs(getNotificationDefaults(profile));
      await queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      toast.success("Notification preferences saved.");
      syncMutation.mutate({ deliverEmail: false });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to save notification preferences.");
    },
  });

  const testMutation = useMutation({
    mutationFn: testPushNotification,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      if (result.pushReady || result.emailSent) {
        toast.success("Test notification delivered.");
      } else {
        toast.success(`Test signal recorded. Delivery: ${reasonLabel(result.reason)} / ${reasonLabel(result.emailReason)}.`);
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to send a test notification.");
    },
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("All notifications marked read.");
    },
  });
  const clearHistoryMutation = useMutation({
    mutationFn: clearNotificationHistory,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success(result.deleted ? "Notification history cleared." : "Notification history was already empty.");
    },
  });

  const openNotification = async (notification: PrepNotification) => {
    if (!notification.read) {
      await markReadMutation.mutateAsync(notification.id).catch(() => undefined);
    }
    navigate(notificationRoute(notification));
  };

  if (profileQuery.isPending && notificationsQuery.isPending) {
    return (
      <div className="surface-panel p-6">
        <div className="flex items-center gap-3 text-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p>Starting notification center...</p>
        </div>
      </div>
    );
  }

  if (profileQuery.isError && notificationsQuery.isError) {
    return (
      <PageStatusPanel
        eyebrow="Notifications"
        title="Notification center could not load."
        description="Your workspace is still usable. Retry to reconnect the live signal feed."
        actionLabel="Retry"
        onAction={() => {
          void profileQuery.refetch();
          void notificationsQuery.refetch();
        }}
        tone="danger"
      />
    );
  }

  return (
    <div className="grid gap-6">
      <section className="surface-panel-strong p-6 md:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="section-label">Notification Center</p>
            <h2 className="mt-2 font-heading text-4xl text-foreground md:text-5xl">
              Live signals that actually show up.
            </h2>
            <p className="mt-3 text-base leading-7 text-foreground/80">
              In-app notifications are the source of truth. Browser push and email are delivery channels layered on top, so the module still works even when a browser blocks permission or SMTP has a bad day.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[28rem]">
            <div className="rounded-[1rem] border border-primary/25 bg-primary/10 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-primary">Unread</p>
              <p className="mt-2 font-heading text-3xl text-foreground">{unreadCount}</p>
            </div>
            <div className="rounded-[1rem] border border-border/80 bg-background/55 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Polling</p>
              <p className="mt-2 text-lg text-foreground">30s</p>
            </div>
            <div className="rounded-[1rem] border border-border/80 bg-background/55 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Browser</p>
              <p className="mt-2 text-lg capitalize text-foreground">{prefs.notificationBrowserPermission}</p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <DeliveryStatus syncResult={syncResult} />
        </div>
      </section>

      <section className="surface-panel p-6 md:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="section-label">Live controls</p>
            <h3 className="mt-2 font-heading text-3xl text-foreground">Pulse, test, and tune delivery.</h3>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              className="h-11 gap-2"
              onClick={() => syncMutation.mutate({ deliverEmail: prefs.notificationsEnabled && prefs.notificationEmailEnabled })}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {syncMutation.isPending ? "Pulsing..." : "Pulse now"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2 border-border/80 bg-background/70"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
            >
              {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Test delivery
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11 gap-2"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending || unreadCount === 0}
            >
              <CheckCheck className="h-4 w-4" />
              Mark read
            </Button>
            <ClearHistoryButton
              title="Clear notification history?"
              description="This removes saved notification records for this account."
              onConfirm={() => clearHistoryMutation.mutate()}
              pending={clearHistoryMutation.isPending}
              disabled={!(notificationsQuery.data || []).length}
              className="h-11 gap-2 border-border/80 bg-background/70"
            />
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-[1rem] border border-border/80 bg-background/50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-foreground">
                  <BellRing className="h-4 w-4" />
                  <p className="text-base">Live module</p>
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Master switch for in-app signal generation.</p>
              </div>
              <Switch
                checked={prefs.notificationsEnabled}
                onCheckedChange={(checked) => setPrefs((current) => ({ ...current, notificationsEnabled: checked }))}
              />
            </div>
          </div>

          <div className="rounded-[1rem] border border-border/80 bg-background/50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-foreground">
                  <Mail className="h-4 w-4" />
                  <p className="text-base">Email</p>
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Send pulse summaries when email is configured.</p>
              </div>
              <Switch
                checked={prefs.notificationEmailEnabled}
                disabled={!prefs.notificationsEnabled}
                onCheckedChange={(checked) => setPrefs((current) => ({ ...current, notificationEmailEnabled: checked }))}
              />
            </div>
          </div>

          <div className="rounded-[1rem] border border-border/80 bg-background/50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-foreground">
                  <Monitor className="h-4 w-4" />
                  <p className="text-base">Browser push</p>
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {runningInsideAndroidApp ? "Unavailable inside the Android shell." : "Uses browser permission and service worker push."}
                </p>
              </div>
              <Switch
                checked={runningInsideAndroidApp ? false : prefs.notificationBrowserEnabled}
                disabled={runningInsideAndroidApp || !prefs.notificationsEnabled}
                onCheckedChange={(checked) => setPrefs((current) => ({ ...current, notificationBrowserEnabled: checked }))}
              />
            </div>
          </div>
        </div>

        <Button
          type="button"
          className="mt-5 h-11 gap-2"
          onClick={() => savePrefsMutation.mutate()}
          disabled={savePrefsMutation.isPending}
        >
          {savePrefsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {savePrefsMutation.isPending ? "Saving..." : "Save and sync"}
        </Button>
      </section>

      <section className="surface-panel p-6 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="section-label">Inbox</p>
            <h3 className="mt-2 font-heading text-3xl text-foreground">Recent notification history</h3>
          </div>

          <div className="inline-flex rounded-full border border-border/80 bg-background/60 p-1">
            {(["all", "unread"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.16em] transition ${
                  filterMode === mode ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setFilterMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {notificationsQuery.isError && (
          <SoftSyncNotice
            title="Notification history is temporarily unavailable."
            description="The live module is still mounted. Retry the inbox feed when the API responds."
            actionLabel="Retry"
            onAction={() => void notificationsQuery.refetch()}
          />
        )}

        {notificationsQuery.isPending && !notificationsQuery.data && (
          <div className="mt-5 rounded-[1rem] border border-border/80 bg-background/50 px-5 py-4 text-sm text-muted-foreground">
            Loading live signal feed.
          </div>
        )}

        {!notificationsQuery.isPending && !notificationsQuery.isError && !(notificationsQuery.data || []).length && (
          <div className="mt-5 rounded-[1rem] border border-border/80 bg-background/50 px-5 py-4 text-sm text-muted-foreground">
            No notifications yet. Hit Pulse now to generate an in-app signal from your current tasks and progress.
          </div>
        )}

        <div className="mt-5 grid gap-3">
          {(notificationsQuery.data || []).map((notification) => {
            const headline = typeof notification.metadata?.headline === "string"
              ? notification.metadata.headline
              : typeof notification.metadata?.title === "string"
                ? notification.metadata.title
                : notificationLabel(notification);
            const whyNow = typeof notification.metadata?.whyNow === "string" ? notification.metadata.whyNow : "";
            const actionText = typeof notification.metadata?.actionText === "string" ? notification.metadata.actionText : "";

            return (
              <article
                key={notification.id}
                className={`rounded-[1rem] border px-5 py-4 transition ${
                  notification.read
                    ? "border-border/80 bg-background/45"
                    : "border-primary/25 bg-primary/10 shadow-[0_0_36px_hsl(0_55%_33%_/_0.08)]"
                }`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/65 px-3 py-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        <Sparkles className="h-3.5 w-3.5" />
                        {notificationLabel(notification)}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/65 px-3 py-1 text-xs text-muted-foreground">
                        <Clock3 className="h-3.5 w-3.5" />
                        {formatTime(notification.sentAt)}
                      </span>
                      {!notification.read && (
                        <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs uppercase tracking-[0.14em] text-primary">
                          unread
                        </span>
                      )}
                    </div>
                    <h4 className="mt-3 text-lg font-medium leading-7 text-foreground">{headline}</h4>
                    <p className="mt-2 text-sm leading-6 text-foreground/80">{notification.message}</p>
                    {(whyNow || actionText) && (
                      <div className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground">
                        {whyNow && <p>{whyNow}</p>}
                        {actionText && <p>{actionText}</p>}
                      </div>
                    )}
                    {!!notification.deliveryChannels.length && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {notification.deliveryChannels.map((channel) => (
                          <span key={channel} className="rounded-full border border-border/60 px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                            {channel}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {!notification.read && (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 gap-2 border-border/80 bg-background/70"
                        onClick={() => markReadMutation.mutate(notification.id)}
                        disabled={markReadMutation.isPending}
                      >
                        <CheckCheck className="h-4 w-4" />
                        Read
                      </Button>
                    )}
                    <Button
                      type="button"
                      className="h-10 gap-2"
                      onClick={() => void openNotification(notification)}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
