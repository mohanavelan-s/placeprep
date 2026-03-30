import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import type { PowerPocketSession, QuickTaskSuggestion, Task } from "@/lib/api";
import { formatHoursFromMinutes } from "@/lib/time";

interface DashboardPowerPocketProps {
  activeSession: PowerPocketSession | null;
  suggestedTask: Task | null;
  quickTask?: QuickTaskSuggestion | null;
  quickTaskLine?: string | null;
  onStart: () => void;
  onEnd: () => void;
  isPending?: boolean;
  onFocusMode?: (active: boolean) => void;
}

export default function DashboardPowerPocket({
  activeSession,
  suggestedTask,
  quickTask,
  quickTaskLine,
  onStart,
  onEnd,
  isPending = false,
  onFocusMode,
}: DashboardPowerPocketProps) {
  const [showBanner, setShowBanner] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const active = Boolean(activeSession);

  const quickMission = {
    title:
      activeSession?.title ||
      quickTask?.title ||
      suggestedTask?.title ||
      "Use this pocket to push one focused task forward",
    ref:
      quickTask?.referenceLabel ||
      suggestedTask?.referenceLabel ||
      suggestedTask?.subcategory ||
      suggestedTask?.weakArea ||
      "Suggested",
    estimatedTime: formatHoursFromMinutes(
      quickTask?.estimatedMinutes || suggestedTask?.estimatedMinutes || 15
    ),
  };

  useEffect(() => {
    onFocusMode?.(active);
  }, [active, onFocusMode]);

  useEffect(() => {
    if (!activeSession) {
      setElapsed(0);
      return undefined;
    }

    const updateElapsed = () => {
      const elapsedSeconds = Math.max(
        0,
        Math.floor((Date.now() - new Date(activeSession.startedAt).getTime()) / 1000)
      );
      setElapsed(elapsedSeconds);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  useEffect(() => {
    if (active) {
      setDismissed(false);
      setShowBanner(false);
      return;
    }

    setShowBanner(true);
  }, [active]);

  const formatTime = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }, []);

  const activate = () => {
    setShowBanner(false);
    onStart();
  };

  const dismiss = () => {
    setShowBanner(false);
    setDismissed(true);
  };

  if (dismissed && !active) {
    return null;
  }

  return (
    <>
      <AnimatePresence>
        {showBanner && !active && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.5 }}
            className="surface-panel group relative overflow-hidden p-5 md:p-6"
          >
            <div className="absolute left-0 top-0 bottom-0 w-px bg-primary/20" />
            <div
              className="pointer-events-none absolute left-0 top-1/4 bottom-1/4 w-8"
              style={{ background: "linear-gradient(90deg, hsl(0 55% 33% / 0.04), transparent)" }}
            />

            <div className="relative flex items-center justify-between gap-6">
              <div>
                <p className="text-base font-medium tracking-wide text-foreground">
                  Power Pocket is ready.
                </p>
                <p className="mt-1.5 text-sm leading-6 body-secondary">
                  {quickTaskLine || `Suggested focus: ${quickMission.title}`}
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  {quickMission.ref} / {quickMission.estimatedTime}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={activate}
                  disabled={isPending}
                  className="rounded-xl border border-primary/30 px-6 py-3 text-xs uppercase tracking-[0.2em] text-primary/95 transition-all duration-300 hover:border-primary/50 hover:bg-primary/10 hover:shadow-[0_0_25px_hsl(0_55%_33%/0.1)] disabled:opacity-50"
                >
                  {isPending ? "Starting" : "Engage"}
                </button>
                <button
                  onClick={dismiss}
                  className="px-3 py-2.5 text-xs uppercase tracking-[0.15em] text-muted-foreground transition-colors duration-300 hover:text-foreground/70"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="power-pocket-active relative overflow-hidden rounded-2xl border border-primary/15 p-6 md:p-8"
          >
            <div className="pointer-events-none absolute inset-0 rounded-sm ember-breathe" />
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, hsl(0 55% 33% / 0.3), transparent)" }}
            />

            <div className="relative z-10">
              <div className="mb-8 flex items-start justify-between gap-6">
                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.32em] text-primary/70">
                    Power Pocket - Active
                  </p>
                  <p className="font-heading text-2xl font-medium text-foreground">
                    Focus mode engaged.
                  </p>
                </div>
                <div className="flex items-center gap-5">
                  <span
                    className="font-heading text-5xl font-medium tracking-tight text-foreground ember-pulse"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {formatTime(elapsed)}
                  </span>
                  <button
                    onClick={onEnd}
                    disabled={isPending}
                    className="rounded-xl border border-border/60 px-4 py-2.5 text-xs uppercase tracking-[0.2em] text-muted-foreground transition-all duration-300 hover:border-foreground/15 hover:text-foreground/70 disabled:opacity-50"
                  >
                    {isPending ? "Ending" : "End"}
                  </button>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-muted/15 p-5">
                <div className="absolute left-0 top-0 bottom-0 w-px bg-primary/25" />
                <p className="mb-3 text-xs uppercase tracking-[0.28em] text-muted-foreground">
                  Quick Mission
                </p>
                <p className="font-body text-lg font-medium tracking-wide text-foreground">
                  {quickMission.title}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span>{quickMission.ref}</span>
                  <span>/</span>
                  <span>{quickMission.estimatedTime}</span>
                  {quickTask?.reason && <span>/ {quickTask.reason}</span>}
                </div>
              </div>

              <p className="mt-6 text-center text-sm tracking-[0.14em] text-muted-foreground">
                No wasted hours.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
