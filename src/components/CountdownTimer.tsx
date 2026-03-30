import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface CountdownTimerProps {
  placementDate?: string | null;
  focusArea?: string | null;
  commandLine?: string | null;
}

function resolveTargetDate(placementDate?: string | null) {
  if (placementDate) {
    const parsedDate = new Date(placementDate);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }

  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

export default function CountdownTimer({
  placementDate,
  focusArea,
  commandLine,
}: CountdownTimerProps) {
  const targetDate = resolveTargetDate(placementDate);

  function getTimeLeft() {
    const diff = targetDate.getTime() - Date.now();
    const days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
    const hours = Math.max(0, Math.floor((diff / (1000 * 60 * 60)) % 24));
    const minutes = Math.max(0, Math.floor((diff / (1000 * 60)) % 60));
    const seconds = Math.max(0, Math.floor((diff / 1000) % 60));
    return { days, hours, minutes, seconds };
  }

  const [timeLeft, setTimeLeft] = useState(getTimeLeft);

  useEffect(() => {
    setTimeLeft(getTimeLeft());
    const i = setInterval(() => setTimeLeft(getTimeLeft()), 1000);
    return () => clearInterval(i);
  }, [placementDate]);

  const urgency = timeLeft.days <= 7;
  const units = [
    { value: timeLeft.days, label: "days" },
    { value: timeLeft.hours, label: "hrs" },
    { value: timeLeft.minutes, label: "min" },
    { value: timeLeft.seconds, label: "sec" },
  ];

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.2 }}
      className="hero-spotlight relative py-10 md:py-14"
    >
      <div className="surface-panel-strong relative z-10 overflow-hidden px-6 py-8 text-center md:px-10 md:py-10">
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="section-label mb-6"
        >
          {urgency ? "Final days" : "Deadline approaches"}
        </motion.p>

        <div className="mx-auto max-w-3xl">
          <h2 className="font-heading text-3xl font-medium text-foreground md:text-4xl">
            Hold the line until placement day.
          </h2>
          {commandLine && (
            <p className="mx-auto mt-3 max-w-2xl text-base leading-7 body-secondary">
              {commandLine}
            </p>
          )}
        </div>

        <div className="mt-10 flex flex-wrap items-end justify-center gap-6 md:gap-8">
          {units.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.1, duration: 0.7 }}
              className="min-w-[92px] flex flex-col items-center"
            >
              <span
                className={`font-heading font-medium tracking-tight ${
                  i === 0 ? "text-6xl md:text-8xl" : "text-5xl md:text-6xl"
                } ${urgency ? "text-primary" : "text-foreground"}`}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {String(item.value).padStart(2, "0")}
              </span>
              <span className="mt-3 text-sm uppercase tracking-[0.2em] text-muted-foreground">
                {item.label}
              </span>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.9, duration: 0.8 }}
          className="soft-divider mx-auto mt-8 mb-6 h-px w-56"
        />

        <div className="flex flex-col items-center justify-center gap-3 md:flex-row">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.6 }}
            className="text-sm tracking-[0.16em] text-muted-foreground"
          >
            Target date: {targetDate.toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </motion.p>
          {focusArea && (
            <span className="coach-chip border-primary/25 text-foreground">
              Focus area: {focusArea}
            </span>
          )}
        </div>
      </div>
    </motion.section>
  );
}
