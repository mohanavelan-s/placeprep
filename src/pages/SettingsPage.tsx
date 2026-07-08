import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, BellRing, CheckCircle2, CreditCard, ExternalLink, Languages, Mail, Monitor, RefreshCw, Save, Send } from "lucide-react";
import { toast } from "sonner";

import AndroidAccessPanel from "@/components/AndroidAccessPanel";
import ClearHistoryButton from "@/components/ClearHistoryButton";
import PersonalProfilePanel from "@/components/PersonalProfilePanel";
import ResumeAnalysisPanel from "@/components/ResumeAnalysisPanel";
import SoftSyncNotice from "@/components/SoftSyncNotice";
import { SettingsSkeleton } from "@/components/WorkspaceSkeletons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useQueryErrorLogger } from "@/hooks/use-query-error-logger";
import { isAndroidPublisherUser } from "@/lib/access";
import { syncBrowserPushSubscription } from "@/lib/browser-push";
import {
  clearNotificationHistory,
  createBillingCheckoutSession,
  createBillingPortalSession,
  fetchBillingAccount,
  fetchBillingStatus,
  fetchServiceHealth,
  fetchNotifications,
  fetchUserProfile,
  markAllNotificationsRead,
  saveUserProfile,
  syncNotifications,
  testPushNotification,
  updateAccount,
  uploadImage,
  verifyBillingPayment,
  type PrepNotification,
  type UserProfile,
} from "@/lib/api";
import { isPlacePrepAndroidApp } from "@/lib/platform";
import { UI_LANGUAGE_OPTIONS, type UiLanguage } from "@/lib/ui-language";

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

function renderNotificationEyebrow(notification: PrepNotification) {
  if (notification.type === "test_notification" || notification.metadata?.source === "manual_push_test") {
    return "Test notification";
  }

  switch (notification.type) {
    case "coach_capsule":
      return "Admin assignment";
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

type EmailTestState = {
  status: "sent" | "queued" | "failed";
  reason?: string;
};

type EmailDeliveryPopup = {
  status: "sent" | "queued" | "failed";
  title: string;
  message: string;
  detail?: string;
};

type RazorpayResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      on: (event: "payment.failed", handler: (response: { error?: { description?: string; reason?: string } }) => void) => void;
      open: () => void;
      close?: () => void;
    };
  }
}

function applyRazorpayCheckoutSizing() {
  let attempts = 0;

  const applySizing = () => {
    attempts += 1;
    const container = document.querySelector<HTMLElement>(".razorpay-container");
    const frame = container?.querySelector<HTMLIFrameElement>("iframe");

    if (!container || !frame) {
      return false;
    }

    container.style.setProperty("z-index", "2147483647", "important");
    container.style.setProperty("position", "fixed", "important");
    container.style.setProperty("inset", "0", "important");
    container.style.setProperty("display", "flex", "important");
    container.style.setProperty("align-items", "center", "important");
    container.style.setProperty("justify-content", "center", "important");

    frame.style.setProperty("position", "fixed", "important");
    frame.style.setProperty("top", "50%", "important");
    frame.style.setProperty("left", "50%", "important");
    frame.style.setProperty("right", "auto", "important");
    frame.style.setProperty("bottom", "auto", "important");
    frame.style.setProperty("transform", "translate(-50%, -50%)", "important");
    frame.style.setProperty("width", "calc(100vw - 24px)", "important");
    frame.style.setProperty("height", "calc(100vh - 24px)", "important");
    frame.style.setProperty("max-width", "1280px", "important");
    frame.style.setProperty("max-height", "860px", "important");
    frame.style.setProperty("border-radius", "12px", "important");
    frame.style.setProperty("box-shadow", "0 28px 90px rgba(0, 0, 0, 0.55)", "important");
    return true;
  };

  applySizing();
  const interval = window.setInterval(() => {
    const applied = applySizing();
    if ((applied && attempts >= 8) || attempts >= 30) {
      window.clearInterval(interval);
    }
  }, 150);

  return () => window.clearInterval(interval);
}

function formatDeliveryReason(reason?: string) {
  if (!reason) {
    return "";
  }

  const normalized = reason.replace(/^Error:\s*/i, "").trim();
  const reasonMap: Record<string, string> = {
    sent: "sent",
    queued: "queued for delivery",
    smtp_ipv6_unreachable: "SMTP IPv6 route is blocked; backend is using IPv4 SMTP",
    smtp_connection_timeout: "SMTP connection timed out",
    smtp_auth_failed: "SMTP login failed",
    smtp_connection_failed: "SMTP connection failed",
    resend_not_configured: "Resend API key or sender is missing",
    resend_delivery_failed: "Resend delivery failed",
    email_not_configured: "email provider is not configured",
    email_notifications_disabled: "email notifications are disabled",
    notifications_disabled: "notifications are disabled",
    delivery_skipped: "email delivery skipped",
    already_emailed: "already emailed",
    already_queued: "already queued",
  };
  const cleaned = reasonMap[normalized] || normalized.replace(/_/g, " ");
  return cleaned.length > 58 ? `${cleaned.slice(0, 55)}...` : cleaned;
}

function formatBillingAmount(amount?: number, currency = "INR", billingCycle?: string) {
  if (!amount) {
    return "";
  }

  const formatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount / 100);
  const suffix = billingCycle === "annual" ? "/year" : billingCycle === "monthly" ? "/month" : "";
  return `${formatted}${suffix}`;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { user, refreshProfile } = useAuth();
  const { language, setLanguage } = useLanguage();
  const runningInsideAndroidApp = isPlacePrepAndroidApp();
  const profileQuery = useQuery({
    queryKey: ["user-profile"],
    queryFn: fetchUserProfile,
  });
  const notificationsQuery = useQuery({
    queryKey: ["notifications", "recent"],
    queryFn: () => fetchNotifications({ limit: 6 }),
  });
  const healthQuery = useQuery({
    queryKey: ["service-health"],
    queryFn: fetchServiceHealth,
    staleTime: 60_000,
  });
  const billingStatusQuery = useQuery({
    queryKey: ["billing", "status"],
    queryFn: fetchBillingStatus,
    staleTime: 60_000,
  });
  const billingAccountQuery = useQuery({
    queryKey: ["billing", "account"],
    queryFn: fetchBillingAccount,
  });

  useQueryErrorLogger("SettingsPage:user-profile", profileQuery.error);
  useQueryErrorLogger("SettingsPage:notifications", notificationsQuery.error);
  useQueryErrorLogger("SettingsPage:service-health", healthQuery.error);
  useQueryErrorLogger("SettingsPage:billing-status", billingStatusQuery.error);
  useQueryErrorLogger("SettingsPage:billing-account", billingAccountQuery.error);

  const [name, setName] = useState(user?.name || "");
  const [username, setUsername] = useState(user?.username || "");
  const [targetRole, setTargetRole] = useState(user?.targetRole || "");
  const [placementDate, setPlacementDate] = useState(user?.placementDate || "");
  const [notificationPrefs, setNotificationPrefs] = useState(getNotificationDefaults(profileQuery.data));
  const [lastEmailTest, setLastEmailTest] = useState<EmailTestState | null>(null);
  const [emailDeliveryPopup, setEmailDeliveryPopup] = useState<EmailDeliveryPopup | null>(null);

  useEffect(() => {
    setName(user?.name || "");
    setUsername(user?.username || "");
    setTargetRole(user?.targetRole || "");
    setPlacementDate(user?.placementDate || "");
  }, [user?.name, user?.placementDate, user?.targetRole, user?.username]);

  useEffect(() => {
    setNotificationPrefs(getNotificationDefaults(profileQuery.data));
  }, [profileQuery.data]);

  const unreadCount = useMemo(
    () => (notificationsQuery.data || []).filter((item) => !item.read).length,
    [notificationsQuery.data],
  );
  const emailDeliveryStatus = useMemo(() => {
    if (lastEmailTest?.status === "failed") {
      return "Test failed";
    }

    if (lastEmailTest?.status === "sent") {
      return "Test sent";
    }

    if (lastEmailTest?.status === "queued") {
      return "Queued";
    }

    if (!notificationPrefs.notificationsEnabled) {
      return "Off";
    }

    if (!notificationPrefs.notificationEmailEnabled) {
      return "Disabled";
    }

    if (healthQuery.data?.emailEnabled) {
      return healthQuery.data.emailProvider === "resend" ? "Resend configured" : "SMTP configured";
    }

    if (healthQuery.isPending) {
      return "Checking";
    }

    if (healthQuery.data?.emailProvider === "resend") {
      return "Needs Resend";
    }

    return "Needs provider";
  }, [
    healthQuery.data?.emailEnabled,
    healthQuery.data?.emailProvider,
    healthQuery.isPending,
    lastEmailTest?.status,
    notificationPrefs.notificationEmailEnabled,
    notificationPrefs.notificationsEnabled,
  ]);
  const emailDeliveryDetail = lastEmailTest?.status === "failed"
    ? formatDeliveryReason(lastEmailTest.reason)
    : user?.email || "";

  const accountMutation = useMutation({
    mutationFn: () =>
      updateAccount({
        name,
        username,
        targetRole,
        placementDate: placementDate || null,
        preferredLanguage: language,
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

  async function loadRazorpayCheckout() {
    if (window.Razorpay) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Unable to load Razorpay checkout.")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Unable to load Razorpay checkout."));
      document.body.appendChild(script);
    });
  }

  const checkoutMutation = useMutation({
    mutationFn: async (plan: { tier: "pro" | "college"; billingCycle?: string; planKey?: string }) => {
      const session = await createBillingCheckoutSession(plan);
      if (session.mode === "hosted" || session.url) {
        if (!session.url) {
          throw new Error("Razorpay hosted checkout did not return a payment URL.");
        }
        window.location.assign(session.url);
        await new Promise<void>(() => undefined);
        return;
      }

      await loadRazorpayCheckout();
      if (!window.Razorpay || !session.keyId || !session.orderId) {
        throw new Error("Razorpay checkout is not ready.");
      }

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        let stopSizing: (() => void) | undefined;

        const finish = () => {
          stopSizing?.();
        };

        const checkout = new window.Razorpay({
          key: session.keyId,
          amount: session.amount,
          currency: session.currency || "INR",
          name: session.name || "PlacePrep",
          description: session.description || "PlacePrep access",
          order_id: session.orderId,
          prefill: session.prefill || {},
          notes: session.notes || {},
          timeout: 300,
          retry: {
            enabled: true,
            max_count: 2,
          },
          theme: {
            color: "#9f2d2d",
          },
          handler: async (response: RazorpayResponse) => {
            try {
              await verifyBillingPayment(response);
              settled = true;
              finish();
              resolve();
            } catch (error) {
              settled = true;
              finish();
              reject(error);
            }
          },
          modal: {
            ondismiss: () => {
              if (!settled) {
                settled = true;
                finish();
                reject(new Error("Razorpay checkout was closed. Start checkout again to generate a fresh QR."));
              }
            },
          },
        });
        checkout.on("payment.failed", (response) => {
          if (!settled) {
            settled = true;
            finish();
            reject(new Error(response.error?.description || response.error?.reason || "Razorpay payment failed."));
          }
        });
        checkout.open();
        stopSizing = applyRazorpayCheckoutSizing();
      });
    },
    onSuccess: async () => {
      toast.success("Payment verified. Your PlacePrep tier is updated.");
      await queryClient.invalidateQueries({ queryKey: ["billing", "account"] });
      await refreshProfile();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to start Razorpay checkout.");
    },
  });

  const billingPortalMutation = useMutation({
    mutationFn: createBillingPortalSession,
    onSuccess: (session) => {
      window.location.assign(session.url);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to open the billing portal.");
    },
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    const billingResult = url.searchParams.get("billing");
    const paymentId = url.searchParams.get("razorpay_payment_id") || "";
    const paymentLinkId = url.searchParams.get("razorpay_payment_link_id") || "";
    const paymentLinkReferenceId = url.searchParams.get("razorpay_payment_link_reference_id") || "";
    const paymentLinkStatus = url.searchParams.get("razorpay_payment_link_status") || "";
    const signature = url.searchParams.get("razorpay_signature") || "";

    if (paymentId && paymentLinkId && paymentLinkReferenceId && paymentLinkStatus && signature) {
      void verifyBillingPayment({
        razorpay_payment_id: paymentId,
        razorpay_payment_link_id: paymentLinkId,
        razorpay_payment_link_reference_id: paymentLinkReferenceId,
        razorpay_payment_link_status: paymentLinkStatus,
        razorpay_signature: signature,
      })
        .then(async () => {
          toast.success("Payment verified. Your PlacePrep tier is updated.");
          await queryClient.invalidateQueries({ queryKey: ["billing", "account"] });
          await refreshProfile();
        })
        .catch((error) => {
          toast.error(error instanceof Error ? error.message : "Payment completed, but verification is still pending.");
          void queryClient.invalidateQueries({ queryKey: ["billing", "account"] });
        });
    } else if (billingResult === "success") {
      toast.success("Payment completed. Your tier will update after confirmation.");
      void queryClient.invalidateQueries({ queryKey: ["billing", "account"] });
      void refreshProfile();
    } else if (billingResult === "cancelled") {
      toast.error("Payment checkout was cancelled.");
    }

    if (billingResult || paymentLinkId || paymentId || signature) {
      url.searchParams.delete("billing");
      url.searchParams.delete("session_id");
      url.searchParams.delete("razorpay_payment_id");
      url.searchParams.delete("razorpay_payment_link_id");
      url.searchParams.delete("razorpay_payment_link_reference_id");
      url.searchParams.delete("razorpay_payment_link_status");
      url.searchParams.delete("razorpay_signature");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, [queryClient, refreshProfile]);

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
    mutationFn: (payload?: { deliverEmail?: boolean }) => syncNotifications(payload),
    onSuccess: (result, payload) => {
      void queryClient.invalidateQueries({ queryKey: ["notifications", "recent"] });
      const signalCopy = result.created.length
        ? `${result.created.length} new mentor signal${result.created.length > 1 ? "s" : ""} synced.`
        : "No new mentor signals right now.";
      const emailCopy = result.emailSent
        ? " Email delivered."
        : result.emailAttempted
          ? ` Email status: ${formatDeliveryReason(result.emailReason)}.`
          : result.emailReady
            ? ""
            : " Email provider is not configured yet.";
      toast.success(`${signalCopy}${emailCopy}`);

      if (payload?.deliverEmail) {
        const detail = formatDeliveryReason(result.emailReason || result.emailError || "");
        setEmailDeliveryPopup({
          status: result.emailSent ? "sent" : result.emailAttempted ? "failed" : "queued",
          title: result.emailSent
            ? "Email notification sent"
            : result.emailAttempted
              ? "Email notification failed"
              : "Email notification not sent",
          message: result.emailSent
            ? `PlacePrep pushed the latest notification email to ${user?.email || "your account email"}.`
            : result.emailReady
              ? "PlacePrep created the signal, but the email channel did not complete."
              : "PlacePrep could not send email because SMTP is not configured on the backend.",
          detail,
        });
      }
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

  const clearNotificationHistoryMutation = useMutation({
    mutationFn: clearNotificationHistory,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["notifications", "recent"] });
      toast.success(
        result.deleted
          ? `Notification history cleared from ${result.deleted} saved signal${result.deleted === 1 ? "" : "s"}.`
          : "Notification history was already empty.",
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to clear notification history.");
    },
  });

  const testPushMutation = useMutation({
    mutationFn: async () => {
      let nextBrowserEnabled = Boolean(
        notificationPrefs.notificationBrowserEnabled
        && notificationPrefs.notificationBrowserPermission === "granted",
      );
      let nextBrowserPermission = notificationPrefs.notificationBrowserPermission || "default";

      if (!runningInsideAndroidApp) {
        try {
          const pushState = await syncBrowserPushSubscription({
            enabled: true,
            requestPermission: true,
          });

          nextBrowserPermission = pushState.permission === "unsupported" ? "denied" : pushState.permission;
          if (pushState.permission === "granted" && pushState.active) {
            nextBrowserEnabled = true;
          } else if (pushState.permission !== "granted") {
            nextBrowserEnabled = false;
          }
        } catch (error) {
          console.error("[SettingsPage] Browser push test setup failed. Email test will still continue.", error);
        }
      }

      const savedProfile = await saveUserProfile(
        buildProfilePayload(profileQuery.data, {
          notificationsEnabled: true,
          notificationEmailEnabled: true,
          notificationBrowserEnabled: nextBrowserEnabled,
          notificationBrowserPermission: nextBrowserPermission,
        }),
      );

      const result = await testPushNotification();
      return {
        savedProfile,
        result,
      };
    },
    onSuccess: ({ savedProfile, result }) => {
      queryClient.setQueryData(["user-profile"], savedProfile);
      setNotificationPrefs(getNotificationDefaults(savedProfile));
      void queryClient.invalidateQueries({ queryKey: ["notifications", "recent"] });
      void queryClient.invalidateQueries({ queryKey: ["service-health"] });

      const pushDelivered = result.sentCount > 0;
      const emailDelivered = result.emailSent;
      const emailQueued = result.emailReason === "queued" || result.emailReason === "already_queued";
      const emailFailed = result.emailAttempted && !emailDelivered && !emailQueued;

      setLastEmailTest(
        emailDelivered
          ? { status: "sent", reason: result.emailReason }
          : emailQueued
            ? { status: "queued", reason: result.emailReason }
            : emailFailed
              ? { status: "failed", reason: result.emailReason }
              : null,
      );

      setEmailDeliveryPopup({
        status: emailDelivered ? "sent" : emailQueued ? "queued" : "failed",
        title: emailDelivered
          ? "Test email sent"
          : emailQueued
            ? "Test email queued"
            : "Test email failed",
        message: emailDelivered
          ? `PlacePrep pushed the test email to ${user?.email || "your account email"}.`
          : emailQueued
            ? `PlacePrep queued the test email for ${user?.email || "your account email"}.`
            : "PlacePrep could not complete the email delivery test.",
        detail: formatDeliveryReason(result.emailReason || result.emailError || ""),
      });

      if (pushDelivered && emailDelivered) {
        toast.success("Test browser push and email sent.");
        return;
      }

      if (pushDelivered && emailQueued) {
        toast.success("Test browser push sent. Test email queued.");
        return;
      }

      if (pushDelivered) {
        toast.error(`Browser push sent, but test email failed: ${formatDeliveryReason(result.emailReason)}.`);
        return;
      }

      if (emailDelivered) {
        toast.success(`Test email sent to ${user?.email || "your account email"}. Browser push status: ${result.reason}.`);
        return;
      }

      if (emailQueued) {
        toast.success(`Test email queued for ${user?.email || "your account email"}. Browser push status: ${result.reason}.`);
        return;
      }

      toast.error(
        `Test notification did not deliver. Browser: ${formatDeliveryReason(result.reason)}. Email: ${formatDeliveryReason(result.emailReason)}.`,
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to send a test notification.");
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
      let nextBrowserEnabled = runningInsideAndroidApp
        ? false
        : notificationPrefs.notificationBrowserEnabled;

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

      if (notificationPrefs.notificationsEnabled && (notificationPrefs.notificationEmailEnabled || nextBrowserEnabled)) {
        try {
          await notificationSyncMutation.mutateAsync({
            deliverEmail: notificationPrefs.notificationEmailEnabled,
          });
        } catch (error) {
          console.error("[SettingsPage] Notification sync failed after saving preferences.", error);
        }
      }
    } catch (error) {
      console.error("[SettingsPage] Failed to save notification preferences.", error);
    }
  }

  if (profileQuery.isPending && !profileQuery.data && notificationsQuery.isPending) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="grid gap-6">
      <section className="surface-panel-strong p-6 md:p-7">
        <p className="section-label">Settings</p>
        <h2 className="mt-2 font-heading text-4xl text-foreground md:text-5xl">
          Control identity, links, and system behavior.
        </h2>
      </section>

      {profileQuery.isError && (
        <SoftSyncNotice
          title="Saved profile links are temporarily unavailable."
          description="Account settings still work normally. Retry when you want your stored links and avatar details back."
          actionLabel="Retry"
          onAction={() => void profileQuery.refetch()}
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

        <div className="mt-5 rounded-[1.4rem] border border-border/80 bg-background/50 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-foreground">
                <Languages className="h-4 w-4" />
                <p className="text-base">Preferred language</p>
              </div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Switches the workspace UI instantly. Saving account settings keeps the choice synced to your account.
              </p>
            </div>
            <div className="w-full lg:max-w-xs">
              <Select value={language} onValueChange={(value) => setLanguage(value as UiLanguage)}>
                <SelectTrigger className="h-11 border-border/80 bg-background/70">
                  <SelectValue placeholder="Choose a language" />
                </SelectTrigger>
                <SelectContent>
                  {UI_LANGUAGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label} / {option.nativeLabel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Button type="button" className="mt-5 h-11 gap-2" onClick={() => accountMutation.mutate()} disabled={accountMutation.isPending}>
          <Save className="h-4 w-4" />
          {accountMutation.isPending ? "Saving..." : "Save account settings"}
        </Button>
      </section>

      <section className="surface-panel p-6 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="section-label">Billing</p>
            <h3 className="mt-2 font-heading text-3xl text-foreground">PlacePrep access</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Current tier: <span className="font-medium capitalize text-foreground">{billingAccountQuery.data?.tier || user?.tier || "free"}</span>
              {billingAccountQuery.data?.billingStatus ? ` / ${billingAccountQuery.data.billingStatus.replace(/_/g, " ")}` : ""}
            </p>
          </div>

          {billingAccountQuery.data?.canManageBilling && (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={billingPortalMutation.isPending}
              onClick={() => billingPortalMutation.mutate()}
            >
              <ExternalLink className="h-4 w-4" />
              {billingPortalMutation.isPending ? "Opening..." : "Manage billing"}
            </Button>
          )}
        </div>

        {billingAccountQuery.isError && (
          <div className="mt-5">
            <SoftSyncNotice
              title="Billing details are temporarily unavailable."
              description="Checkout configuration can still be checked. Retry to restore your subscription status."
              actionLabel="Retry"
              onAction={() => void billingAccountQuery.refetch()}
            />
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {(billingStatusQuery.data?.availablePlans || []).map((plan) => {
            const planKey = plan.planKey || `${plan.tier}-${plan.billingCycle || "default"}`;
            const currentTier = billingAccountQuery.data?.billingTier || billingAccountQuery.data?.tier;
            const currentCycle = billingAccountQuery.data?.billingCycle || null;
            const isCurrent = currentTier === plan.tier
              && (plan.tier !== "pro" || !currentCycle || currentCycle === plan.billingCycle);
            const pendingThisPlan = checkoutMutation.isPending && checkoutMutation.variables?.planKey === plan.planKey;
            const priceLabel = formatBillingAmount(plan.amount, plan.currency || billingStatusQuery.data?.currency || "INR", plan.billingCycle);
            return (
              <div key={planKey} className="rounded-lg border border-border/80 bg-background/45 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {plan.tier}
                  {plan.billingCycle ? ` / ${plan.billingCycle}` : ""}
                </p>
                <p className="mt-2 font-heading text-2xl text-foreground">{plan.label}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {priceLabel || (plan.quoteBased ? "Quote-based annual plan" : "Amount not configured")}
                </p>
                <Button
                  type="button"
                  className="mt-5 gap-2"
                  variant={isCurrent ? "outline" : "default"}
                  disabled={isCurrent || checkoutMutation.isPending || !plan.configured}
                  onClick={() => checkoutMutation.mutate({
                    tier: plan.tier,
                    billingCycle: plan.billingCycle,
                    planKey: plan.planKey,
                  })}
                >
                  <CreditCard className="h-4 w-4" />
                  {isCurrent
                    ? "Current plan"
                    : !plan.configured
                      ? plan.quoteBased ? "Quote required" : "Not configured"
                    : pendingThisPlan
                      ? "Opening checkout..."
                      : plan.tier === "pro"
                        ? `Choose ${plan.billingCycle === "annual" ? "Annual" : "Monthly"}`
                        : "Choose College"}
                </Button>
              </div>
            );
          })}
        </div>

        {!billingStatusQuery.isPending && !(billingStatusQuery.data?.availablePlans || []).length && (
          <p className="mt-5 text-sm text-muted-foreground">
            Razorpay plans are not configured on this deployment yet.
          </p>
        )}
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
          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[24rem]">
            <div className="rounded-2xl border border-border/80 bg-background/60 px-4 py-3 text-sm text-foreground/80">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Email delivery</p>
              <p className="mt-2 font-medium">{emailDeliveryStatus}</p>
              {emailDeliveryDetail && (
                <p className="mt-1 max-w-[12rem] truncate text-xs text-muted-foreground">{emailDeliveryDetail}</p>
              )}
            </div>
            <div className="rounded-2xl border border-border/80 bg-background/60 px-4 py-3 text-sm text-foreground/80">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Browser permission</p>
              <p className="mt-2 font-medium capitalize">
                {notificationPrefs.notificationBrowserPermission}
              </p>
            </div>
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
                    <p className="text-base">
                      {runningInsideAndroidApp ? "Browser alerts unavailable in app" : "Background browser alerts"}
                    </p>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {runningInsideAndroidApp
                      ? "The Android APK now opens the full web workspace, but browser push still belongs to desktop and mobile browsers rather than the embedded app shell."
                      : "Real web push for this browser, even when PlacePrep is closed."}
                  </p>
                </div>
                <Switch
                  checked={runningInsideAndroidApp ? false : notificationPrefs.notificationBrowserEnabled}
                  disabled={runningInsideAndroidApp || !notificationPrefs.notificationsEnabled}
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
            onClick={() => void notificationSyncMutation.mutate({
              deliverEmail: notificationPrefs.notificationsEnabled && notificationPrefs.notificationEmailEnabled,
            })}
            disabled={notificationSyncMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 ${notificationSyncMutation.isPending ? "animate-spin" : ""}`} />
            {notificationSyncMutation.isPending ? "Syncing..." : "Sync now"}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-11 gap-2 border-border/80 bg-background/70"
            onClick={() => void testPushMutation.mutateAsync()}
            disabled={testPushMutation.isPending}
          >
            <Send className="h-4 w-4" />
            {testPushMutation.isPending ? "Sending test..." : "Send test notification"}
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

          <ClearHistoryButton
            title="Clear notification history?"
            description="This removes saved notification history for this account after confirmation."
            onConfirm={() => clearNotificationHistoryMutation.mutate()}
            pending={clearNotificationHistoryMutation.isPending}
            disabled={!(notificationsQuery.data || []).length}
            className="h-11 gap-2 border-border/80 bg-background/70"
          />
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
            <SoftSyncNotice
              title="Notification history is temporarily unavailable."
              description="Your notification settings still work. Retry when you want the recent signal log back."
              actionLabel="Retry"
              onAction={() => void notificationsQuery.refetch()}
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
                      {renderNotificationEyebrow(item)}
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

      <ResumeAnalysisPanel defaultTargetRole={targetRole || user?.targetRole || ""} />

      <AndroidAccessPanel adminMode={isAndroidPublisherUser(user)} />
      <Dialog open={Boolean(emailDeliveryPopup)} onOpenChange={(open) => !open && setEmailDeliveryPopup(null)}>
        <DialogContent className="border-border/80 bg-background">
          <DialogHeader>
            <div className="mb-2 flex items-center gap-3">
              {emailDeliveryPopup?.status === "failed" ? (
                <AlertCircle className="h-5 w-5 text-destructive" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              )}
              <DialogTitle>{emailDeliveryPopup?.title || "Email status"}</DialogTitle>
            </div>
            <DialogDescription className="leading-6">
              {emailDeliveryPopup?.message}
            </DialogDescription>
          </DialogHeader>
          {emailDeliveryPopup?.detail && (
            <div className="rounded-lg border border-border/80 bg-muted/30 p-3 text-sm text-muted-foreground">
              {emailDeliveryPopup.detail}
            </div>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => setEmailDeliveryPopup(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
