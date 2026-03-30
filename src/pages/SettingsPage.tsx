import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Mail, Monitor, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

import AdminInvitePanel from "@/components/AdminInvitePanel";
import AndroidAccessPanel from "@/components/AndroidAccessPanel";
import PageStatusPanel from "@/components/PageStatusPanel";
import PersonalProfilePanel from "@/components/PersonalProfilePanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";
import { useQueryErrorLogger } from "@/hooks/use-query-error-logger";
import {
  fetchNotifications,
  fetchUserProfile,
  markAllNotificationsRead,
  saveUserProfile,
  syncNotifications,
  updateAccount,
  uploadImage,
  type PrepNotification,
  type UserProfile,
} from "@/lib/api";

function buildProfilePayload(profile?: UserProfile | null, overrides?: Partial<UserProfile>) {
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

function formatNotificationTime(value: string) {
  try {
    return new Date(value).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function renderNotificationEyebrow(type: PrepNotification["type"]) {
  switch (type) {
    case "countdown_urgency":
      return "Countdown urgency";
    case "daily_inactivity":
      return "Daily inactivity";
    case "missed_streak":
      return "Missed streak";
    case "pending_tasks":
      return "Pending tasks";
    default:
      return "Motivation";
  }
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { user, refreshProfile } = useAuth();
  const profileQuery = useQuery({
    queryKey: ["user-profile"],
    queryFn: fetchUserProfile,
  });
  const notificationsQuery = useQuery({
    queryKey: ["notifications", "recent"],
    queryFn: () => fetchNotifications({ limit: 6 }),
  });

  useQueryErrorLogger("SettingsPage:user-profile", profileQuery.error);
  useQueryErrorLogger("SettingsPage:notifications", notificationsQuery.error);

  const [name, setName] = useState(user?.name || "");
  const [username, setUsername] = useState(user?.username || "");
  const [targetRole, setTargetRole] = useState(user?.targetRole || "");
  const [placementDate, setPlacementDate] = useState(user?.placementDate || "");
  const [notificationPrefs, setNotificationPrefs] = useState(getNotificationDefaults(profileQuery.data));

  useEffect(() => {
    setName(user?.name || "");
    setUsername(user?.username || "");
    setTargetRole(user?.targetRole || "");
    setPlacementDate(user?.placementDate || "");
  }, [user?.name, user?.placementDate, user?.targetRole, user?.username]);

  useEffect(() => {
    setNotificationPrefs(getNotificationDefaults(profileQuery.data));
  }, [
    profileQuery.data?.notificationBrowserEnabled,
    profileQuery.data?.notificationBrowserPermission,
    profileQuery.data?.notificationEmailEnabled,
    profileQuery.data?.notificationsEnabled,
  ]);

  const unreadCount = useMemo(
    () => (notificationsQuery.data || []).filter((item) => !item.read).length,
    [notificationsQuery.data],
  );

  const accountMutation = useMutation({
    mutationFn: () =>
      updateAccount({
        name,
        username,
        targetRole,
        placementDate: placementDate || null,
      }),
    onSuccess: async () => {
      await refreshProfile();
      void queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      void queryClient.invalidateQueries({ queryKey: ["prep-plan", "latest"] });
      void queryClient.invalidateQueries({ queryKey: ["progress-summary"] });
      toast.success("Account settings updated.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to update account settings.");
    },
  });

  const profileMutation = useMutation({
    mutationFn: saveUserProfile,
    onSuccess: (result) => {
      queryClient.setQueryData(["user-profile"], result);
      toast.success("Profile updated.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to save profile.");
    },
  });

  const notificationPreferencesMutation = useMutation({
    mutationFn: saveUserProfile,
    onSuccess: (result) => {
      queryClient.setQueryData(["user-profile"], result);
      toast.success("Notification settings updated.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to save notification settings.");
    },
  });

  const notificationSyncMutation = useMutation({
    mutationFn: syncNotifications,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["notifications", "recent"] });
      toast.success(
        result.created.length
          ? `${result.created.length} new mentor signal${result.created.length > 1 ? "s" : ""} synced.`
          : "No new mentor signals right now.",
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to sync notifications.");
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications", "recent"] });
      toast.success("Notification list cleared.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to mark notifications as read.");
    },
  });

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const uploaded = await uploadImage(file, { caption: "profile-avatar" });
      const savedProfile = await saveUserProfile(
        buildProfilePayload(profileQuery.data, { avatarUrl: uploaded.secureUrl }),
      );

      return savedProfile;
    },
    onSuccess: (result) => {
      queryClient.setQueryData(["user-profile"], result);
      toast.success("Profile icon updated.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to upload profile icon.");
    },
  });

  async function handleNotificationSave() {
    try {
      let nextPermission = notificationPrefs.notificationBrowserPermission || "default";
      let nextBrowserEnabled = notificationPrefs.notificationBrowserEnabled;

      if (notificationPrefs.notificationsEnabled && nextBrowserEnabled) {
        if (typeof window === "undefined" || !("Notification" in window)) {
          console.error("[SettingsPage] Browser notifications are not supported in this environment.");
          toast.error("Browser notifications are not supported in this browser.");
          nextBrowserEnabled = false;
          nextPermission = "denied";
        } else {
          if (window.Notification.permission === "default") {
            nextPermission = await window.Notification.requestPermission();
          } else {
            nextPermission = window.Notification.permission;
          }

          if (nextPermission !== "granted") {
            nextBrowserEnabled = false;
            toast.error("Browser notification permission was not granted.");
          }
        }
      }

      const savedProfile = await notificationPreferencesMutation.mutateAsync(
        buildProfilePayload(profileQuery.data, {
          notificationsEnabled: notificationPrefs.notificationsEnabled,
          notificationEmailEnabled: notificationPrefs.notificationEmailEnabled,
          notificationBrowserEnabled: nextBrowserEnabled,
          notificationBrowserPermission: nextPermission,
        }),
      );

      setNotificationPrefs(getNotificationDefaults(savedProfile));

      if (nextBrowserEnabled && nextPermission === "granted") {
        try {
          await notificationSyncMutation.mutateAsync();
        } catch (error) {
          console.error("[SettingsPage] Notification sync failed after saving preferences.", error);
        }
      }
    } catch (error) {
      console.error("[SettingsPage] Failed to save notification preferences.", error);
    }
  }

  return (
    <div className="grid gap-6">
      <section className="surface-panel-strong p-6 md:p-7">
        <p className="section-label">Settings</p>
        <h2 className="mt-2 font-heading text-4xl text-foreground md:text-5xl">
          Control identity, links, and system behavior.
        </h2>
      </section>

      {profileQuery.isPending && !profileQuery.data && (
        <PageStatusPanel
          eyebrow="Settings sync"
          title="Loading your saved preferences."
          description="Account settings and personal links are being restored."
          loading
        />
      )}

      {profileQuery.isError && (
        <PageStatusPanel
          eyebrow="Settings fallback"
          title="Saved links could not be loaded."
          description="You can still update your account settings, and retry the profile links request when ready."
          actionLabel="Retry"
          onAction={() => void profileQuery.refetch()}
          tone="danger"
        />
      )}

      <section className="surface-panel p-6 md:p-7">
        <div className="mb-6">
          <p className="section-label">Account</p>
          <h3 className="mt-2 font-heading text-3xl text-foreground">Username and profile</h3>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm text-muted-foreground">Display name</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} className="h-11 border-border/80 bg-background/70" />
          </label>

          <label className="space-y-2">
            <span className="text-sm text-muted-foreground">Username</span>
            <Input value={username} onChange={(event) => setUsername(event.target.value)} className="h-11 border-border/80 bg-background/70" />
          </label>

          <label className="space-y-2">
            <span className="text-sm text-muted-foreground">Target role</span>
            <Input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} className="h-11 border-border/80 bg-background/70" />
          </label>

          <label className="space-y-2">
            <span className="text-sm text-muted-foreground">Placement date</span>
            <Input type="date" value={placementDate || ""} onChange={(event) => setPlacementDate(event.target.value)} className="h-11 border-border/80 bg-background/70" />
          </label>
        </div>

        <Button type="button" className="mt-5 h-11 gap-2" onClick={() => accountMutation.mutate()} disabled={accountMutation.isPending}>
          <Save className="h-4 w-4" />
          {accountMutation.isPending ? "Saving..." : "Save account settings"}
        </Button>
      </section>

      <section className="surface-panel p-6 md:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="section-label">Notifications</p>
            <h3 className="mt-2 font-heading text-3xl text-foreground">Strict signals. No fluff.</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Daily reminders, pending task pressure, streak warnings, deadline urgency, and sharp motivation.
            </p>
          </div>
          <div className="rounded-2xl border border-border/80 bg-background/60 px-4 py-3 text-sm text-foreground/80">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Browser permission</p>
            <p className="mt-2 font-medium capitalize">
              {notificationPrefs.notificationBrowserPermission}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          <div className="rounded-[1.4rem] border border-border/80 bg-background/50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-foreground">
                  <BellRing className="h-4 w-4" />
                  <p className="text-base">Strict notifications</p>
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Master switch for all mentor reminders.
                </p>
              </div>
              <Switch
                checked={notificationPrefs.notificationsEnabled}
                onCheckedChange={(checked) =>
                  setNotificationPrefs((current) => ({ ...current, notificationsEnabled: checked }))
                }
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[1.4rem] border border-border/80 bg-background/50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-foreground">
                    <Mail className="h-4 w-4" />
                    <p className="text-base">Email prompts</p>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    One premium daily signal, delivered with pressure instead of spam.
                  </p>
                </div>
                <Switch
                  checked={notificationPrefs.notificationEmailEnabled}
                  disabled={!notificationPrefs.notificationsEnabled}
                  onCheckedChange={(checked) =>
                    setNotificationPrefs((current) => ({ ...current, notificationEmailEnabled: checked }))
                  }
                />
              </div>
            </div>

            <div className="rounded-[1.4rem] border border-border/80 bg-background/50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-foreground">
                    <Monitor className="h-4 w-4" />
                    <p className="text-base">Browser alerts</p>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Triggered when PlacePrep opens and fresh signals are waiting.
                  </p>
                </div>
                <Switch
                  checked={notificationPrefs.notificationBrowserEnabled}
                  disabled={!notificationPrefs.notificationsEnabled}
                  onCheckedChange={(checked) =>
                    setNotificationPrefs((current) => ({ ...current, notificationBrowserEnabled: checked }))
                  }
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            type="button"
            className="h-11 gap-2"
            onClick={() => void handleNotificationSave()}
            disabled={notificationPreferencesMutation.isPending}
          >
            <Save className="h-4 w-4" />
            {notificationPreferencesMutation.isPending ? "Saving..." : "Save notification settings"}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-11 gap-2 border-border/80 bg-background/70"
            onClick={() => void notificationSyncMutation.mutate()}
            disabled={notificationSyncMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 ${notificationSyncMutation.isPending ? "animate-spin" : ""}`} />
            {notificationSyncMutation.isPending ? "Syncing..." : "Sync now"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="h-11"
            onClick={() => void markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending || unreadCount === 0}
          >
            Mark all read
          </Button>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="section-label">Recent signals</p>
              <h4 className="mt-2 font-heading text-2xl text-foreground">Latest pressure from the system.</h4>
            </div>
            <div className="coach-chip border-primary/25">
              {unreadCount} unread
            </div>
          </div>

          {notificationsQuery.isPending && !notificationsQuery.data && (
            <div className="mt-4 rounded-[1.4rem] border border-border/80 bg-background/50 px-5 py-4 text-sm text-muted-foreground">
              Loading recent notification history.
            </div>
          )}

          {notificationsQuery.isError && (
            <PageStatusPanel
              eyebrow="Notification fallback"
              title="Notification history could not be loaded."
              description="Your settings still work. Retry when you want the recent signal log back."
              actionLabel="Retry"
              onAction={() => void notificationsQuery.refetch()}
              tone="danger"
            />
          )}

          {!notificationsQuery.isPending && !notificationsQuery.isError && !(notificationsQuery.data || []).length && (
            <div className="mt-4 rounded-[1.4rem] border border-border/80 bg-background/50 px-5 py-4 text-sm text-muted-foreground">
              No signals have been generated yet. The scheduler will start pressing when activity drifts.
            </div>
          )}

          <div className="mt-4 grid gap-3">
            {(notificationsQuery.data || []).map((item) => (
              <article
                key={item.id}
                className="rounded-[1.35rem] border border-border/80 bg-background/50 px-5 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                      {renderNotificationEyebrow(item.type)}
                    </p>
                    <p className="mt-2 text-base leading-7 text-foreground">{item.message}</p>
                  </div>
                  <div className="text-right text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    <div>{item.read ? "Read" : "Unread"}</div>
                    <div className="mt-2 normal-case tracking-normal">{formatNotificationTime(item.sentAt)}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <PersonalProfilePanel
        profile={profileQuery.data}
        displayName={user?.name}
        isSaving={profileMutation.isPending}
        isUploadingAvatar={avatarMutation.isPending}
        onSave={profileMutation.mutateAsync}
        onUploadAvatar={async (file) => {
          const result = await avatarMutation.mutateAsync(file);
          return result.avatarUrl || "";
        }}
      />

      <AndroidAccessPanel adminMode={user?.role === "admin"} />

      {user?.role === "admin" && <AdminInvitePanel />}
    </div>
  );
}
