import { motion } from "framer-motion";
import { BrainCircuit, Flame, Gauge, TimerReset } from "lucide-react";

import type { CoachProfile } from "@/lib/api";
import { formatHoursFromMinutes } from "@/lib/time";

interface CoachProfilePanelProps {
  profile?: CoachProfile | null;
  userName: string;
  targetRole?: string | null;
}

function formatMinutes(value?: number) {
  return formatHoursFromMinutes(value);
}

export default function CoachProfilePanel({
  profile,
  userName,
  targetRole,
}: CoachProfilePanelProps) {
  const weakTopics = profile?.weakTopics ?? [];
  const strongTopics = profile?.strongTopics ?? [];

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7 }}
      className="surface-panel-strong overflow-hidden p-6 md:p-7"
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <p className="section-label">AI Coach</p>
          <div className="flex flex-col gap-2">
            <h2 className="font-heading text-3xl font-medium text-foreground md:text-4xl">
              {userName}, the system is watching your prep pattern.
            </h2>
            <p className="max-w-2xl text-base leading-7 body-secondary">
              {profile?.commandLine ||
                "Your coach profile is still warming up. Open the dashboard daily so the system can tighten the plan around your real behavior."}
            </p>
            <p className="text-sm text-foreground/70">
              Target lane: {targetRole || "Placement preparation"}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Solved problems",
              value: profile?.solvedProblems ?? 0,
              icon: BrainCircuit,
            },
            {
              label: "Avg solve time",
              value: formatMinutes(profile?.averageTimePerProblem),
              icon: TimerReset,
            },
            {
              label: "Failed attempts",
              value: profile?.failedAttempts ?? 0,
              icon: Flame,
            },
            {
              label: "Readiness",
              value: `${Math.round(profile?.readinessScore ?? 0)}%`,
              icon: Gauge,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="metric-panel p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                    {item.label}
                  </p>
                  <Icon className="h-4 w-4 text-primary/80" />
                </div>
                <p className="font-heading text-3xl font-medium text-foreground">
                  {item.value}
                </p>
              </div>
            );
          })}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-border/80 bg-card/70 p-5">
            <p className="section-label">Weak Topics</p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {weakTopics.length ? (
                weakTopics.map((topic) => (
                  <span key={topic} className="coach-chip border-primary/30 text-foreground">
                    {topic}
                  </span>
                ))
              ) : (
                <p className="text-sm body-secondary">
                  No weak topics detected yet. Keep logging real work and struggles.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card/70 p-5">
            <p className="section-label">Strong Topics</p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {strongTopics.length ? (
                strongTopics.map((topic) => (
                  <span key={topic} className="coach-chip border-accent/30 text-foreground">
                    {topic}
                  </span>
                ))
              ) : (
                <p className="text-sm body-secondary">
                  The system needs a little more completed work before it can trust your strengths.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
