import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PowerPocketProps {
  onFocusMode?: (active: boolean) => void;
}

export default function PowerPocket({ onFocusMode }: PowerPocketProps) {
  const [showBanner, setShowBanner] = useState(true);
  const [active, setActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const quickMission = {
    title: "Valid Parentheses",
    ref: "LC #20",
    estimatedTime: "15 min",
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (active) {
      interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [active]);

  const formatTime = useCallback((s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }, []);

  const activate = () => {
    setShowBanner(false);
    setActive(true);
    onFocusMode?.(true);
  };

  const dismiss = () => {
    setShowBanner(false);
    setDismissed(true);
  };

  const endSession = () => {
    setActive(false);
    setElapsed(0);
    onFocusMode?.(false);
  };

  if (dismissed && !active) return null;

  return (
    <>
      {/* Banner — understated, serious */}
      <AnimatePresence>
        {showBanner && !active && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.5 }}
            className="bg-gradient-surface border border-border/60 rounded-sm p-5 relative overflow-hidden group"
          >
            {/* Subtle left-edge glow */}
            <div className="absolute left-0 top-0 bottom-0 w-px bg-primary/20" />
            <div className="absolute left-0 top-1/4 bottom-1/4 w-8 pointer-events-none"
              style={{ background: "linear-gradient(90deg, hsl(0 55% 33% / 0.04), transparent)" }}
            />

            <div className="relative flex items-center justify-between">
              <div>
                <p className="font-body text-[13px] text-foreground/70 tracking-wide">
                  Unplanned time detected.
                </p>
                <p className="text-[9px] text-muted-foreground/50 mt-1.5 tracking-wide">
                  Capture it or lose it.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={activate}
                  className="px-6 py-2.5 border border-primary/30 text-primary/90 rounded-sm text-[10px] tracking-[0.2em] uppercase hover:bg-primary/10 hover:border-primary/50 transition-all duration-300 hover:shadow-[0_0_25px_hsl(0_55%_33%/0.1)]"
                >
                  Engage
                </button>
                <button
                  onClick={dismiss}
                  className="px-3 py-2.5 text-muted-foreground/40 text-[10px] tracking-[0.15em] uppercase hover:text-muted-foreground/70 transition-colors duration-300"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Session — cinematic focus mode */}
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="power-pocket-active rounded-sm border border-primary/15 p-8 relative overflow-hidden"
          >
            {/* Inner glow edge */}
            <div className="absolute inset-0 rounded-sm ember-breathe pointer-events-none" />
            <div className="absolute top-0 left-0 right-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, hsl(0 55% 33% / 0.3), transparent)" }}
            />

            <div className="relative z-10">
              {/* Header */}
              <div className="flex items-start justify-between mb-8">
                <div>
                  <p className="font-body text-[8px] tracking-[0.4em] uppercase text-primary/60 mb-2">
                    Power Pocket — Active
                  </p>
                  <p className="font-heading text-lg font-light text-foreground/60 italic">
                    Focus mode engaged.
                  </p>
                </div>
                <div className="flex items-center gap-5">
                  <span
                    className="font-heading text-4xl font-light text-foreground tracking-tight ember-pulse"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {formatTime(elapsed)}
                  </span>
                  <button
                    onClick={endSession}
                    className="px-4 py-2 text-[9px] tracking-[0.2em] uppercase text-muted-foreground/50 border border-border/50 rounded-sm hover:text-foreground/60 hover:border-foreground/15 transition-all duration-300"
                  >
                    End
                  </button>
                </div>
              </div>

              {/* Mission card */}
              <div className="border border-border/40 rounded-sm p-5 bg-muted/15 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-px bg-primary/25" />
                <p className="text-[8px] tracking-[0.3em] uppercase text-muted-foreground/50 mb-3">
                  Quick Mission
                </p>
                <p className="font-body text-[13px] text-foreground/70 tracking-wide">{quickMission.title}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[8px] text-muted-foreground/40">{quickMission.ref}</span>
                  <span className="text-[8px] text-muted-foreground/20">·</span>
                  <span className="text-[8px] text-muted-foreground/40">~{quickMission.estimatedTime}</span>
                </div>
              </div>

              {/* Bottom line */}
              <p className="text-[9px] text-center text-muted-foreground/30 mt-6 tracking-[0.15em]">
                No wasted hours.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
