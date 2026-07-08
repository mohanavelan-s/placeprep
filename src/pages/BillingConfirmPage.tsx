import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import PlacePrepLogo from "@/components/PlacePrepLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import {
  createBillingCheckoutSession,
  fetchBillingStatus,
  verifyBillingPayment,
  type BillingStatus,
} from "@/lib/api";

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

function formatBillingAmount(amount?: number, currency = "INR", billingCycle?: string) {
  if (!amount) {
    return "Amount not configured";
  }

  const formatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount / 100);
  const suffix = billingCycle === "annual" ? "/year" : billingCycle === "monthly" ? "/month" : "";
  return `${formatted}${suffix}`;
}

function planBenefits(plan?: BillingStatus["availablePlans"][number]) {
  if (plan?.tier === "college") {
    return [
      "College access for placement preparation cohorts.",
      "Admin-ready billing record for annual access.",
      "AI roadmap, mentor, analytics, and practice workflows for enabled users.",
    ];
  }

  if (plan?.billingCycle === "annual") {
    return [
      "Twelve months of PlacePrep Pro access.",
      "AI Prep Architect, Nocturne Mentor, tasks, analytics, and assessments.",
      "Better value than paying monthly.",
    ];
  }

  return [
    "One month of PlacePrep Pro access.",
    "AI Prep Architect, Nocturne Mentor, tasks, analytics, and assessments.",
    "Good for trying the full placement workflow first.",
  ];
}

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

export default function BillingConfirmPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, refreshProfile } = useAuth();
  const [contactNumber, setContactNumber] = useState("");
  const planKey = searchParams.get("planKey") || "";

  const billingStatusQuery = useQuery({
    queryKey: ["billing", "status"],
    queryFn: fetchBillingStatus,
    staleTime: 60_000,
  });

  const selectedPlan = useMemo(() => {
    return (billingStatusQuery.data?.availablePlans || []).find((plan) => plan.planKey === planKey) || null;
  }, [billingStatusQuery.data?.availablePlans, planKey]);

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPlan) {
        throw new Error("Select a valid PlacePrep plan before checkout.");
      }

      const session = await createBillingCheckoutSession({
        tier: selectedPlan.tier,
        billingCycle: selectedPlan.billingCycle,
        planKey: selectedPlan.planKey,
        contact: contactNumber.trim() || undefined,
      });

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
        const finish = () => stopSizing?.();

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
      navigate("/settings");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to start Razorpay checkout.");
    },
  });

  const priceLabel = selectedPlan
    ? formatBillingAmount(selectedPlan.amount, selectedPlan.currency || billingStatusQuery.data?.currency || "INR", selectedPlan.billingCycle)
    : "";
  const isInvalidPlan = !billingStatusQuery.isPending && (!planKey || !selectedPlan || !selectedPlan.configured);

  return (
    <main className="min-h-screen bg-background text-foreground vignette">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(0_55%_33%_/_0.13),transparent_35%)]" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4 border-b border-border/70 pb-5">
          <Link to="/settings" className="flex min-w-0 items-center gap-3 text-sm text-muted-foreground transition hover:text-foreground">
            <PlacePrepLogo compact />
            <div className="min-w-0">
              <p className="font-heading text-xl leading-none text-foreground">PlacePrep</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Billing confirmation</p>
            </div>
          </Link>
          <Button asChild variant="outline" className="h-10 gap-2 px-4">
            <Link to="/settings">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        </header>

        <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.36em] text-muted-foreground">Confirm access</p>
            <h1 className="mt-4 font-heading text-4xl font-light leading-tight text-foreground sm:text-5xl">
              Review the plan. Then pay on Razorpay.
            </h1>
            <p className="mt-5 text-sm leading-7 text-muted-foreground">
              PlacePrep creates the payment securely on the backend. Razorpay handles the final UPI, card, wallet, or netbanking step.
            </p>
          </div>

          <div className="border-t border-border/80 pt-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            {billingStatusQuery.isPending ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Checking billing plans.</p>
              </div>
            ) : isInvalidPlan ? (
              <div className="space-y-5">
                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Plan unavailable</p>
                <h2 className="font-heading text-3xl text-foreground">Choose a valid PlacePrep plan.</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  This checkout link is missing a configured plan. Return to Settings and choose a current billing option.
                </p>
                <Button asChild className="gap-2">
                  <Link to="/settings">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Settings
                  </Link>
                </Button>
              </div>
            ) : selectedPlan ? (
              <div className="space-y-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                      {selectedPlan.tier} {selectedPlan.billingCycle ? `/ ${selectedPlan.billingCycle}` : ""}
                    </p>
                    <h2 className="mt-2 font-heading text-4xl text-foreground">{selectedPlan.label}</h2>
                  </div>
                  <CreditCard className="h-6 w-6 text-muted-foreground" />
                </div>

                <div className="grid gap-4 md:grid-cols-[0.86fr_1.14fr]">
                  <div className="border-y border-border/80 py-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Amount payable</p>
                    <p className="mt-2 text-4xl font-semibold text-foreground">{priceLabel}</p>
                    <p className="mt-2 text-sm text-muted-foreground">Billed to {user?.email || "your PlacePrep account"}</p>
                  </div>

                  <div className="border-y border-border/80 py-5">
                    <label htmlFor="billing-contact" className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                      Mobile number
                    </label>
                    <Input
                      id="billing-contact"
                      value={contactNumber}
                      onChange={(event) => setContactNumber(event.target.value)}
                      placeholder="Optional, helps Razorpay skip contact details"
                      className="mt-3 h-11"
                      inputMode="tel"
                    />
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      Use a 10 digit Indian number, or include country code.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {planBenefits(selectedPlan).map((benefit) => (
                    <div key={benefit} className="border-t border-border/70 pt-4 text-sm leading-6 text-muted-foreground">
                      <CheckCircle2 className="mb-3 h-4 w-4 text-green-400" />
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 border-y border-border/70 py-4 text-sm leading-6 text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                  <span>Razorpay handles the final payment page. PlacePrep verifies payment before updating access.</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <Button
                    type="button"
                    className="gap-2"
                    disabled={checkoutMutation.isPending}
                    onClick={() => checkoutMutation.mutate()}
                  >
                    {checkoutMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Continue to Razorpay
                  </Button>
                  <Button asChild type="button" variant="outline">
                    <Link to="/settings">Back to Settings</Link>
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
