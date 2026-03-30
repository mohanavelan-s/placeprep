import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

import type { Task } from "@/lib/api";
import { formatHoursFromMinutes } from "@/lib/time";

const categoryAccent: Record<string, string> = {
  DSA: "border-l-primary/50",
  Core: "border-l-accent/40",
  DBMS: "border-l-accent/40",
  Project: "border-l-foreground/20",
};

interface DashboardDailyTasksProps {
  missions: Task[];
  updatingTaskId?: string | null;
  onToggleMission: (task: Task) => void;
  activeTaskId?: string | null;
}

function formatDifficulty(value?: number | null) {
  if (!value || value <= 2) {
    return "Easy";
  }

  if (value >= 4) {
    return "Hard";
  }

  return "Medium";
}

export default function DashboardDailyTasks({
  missions,
  updatingTaskId,
  onToggleMission,
  activeTaskId,
}: DashboardDailyTasksProps) {
  const completed = missions.filter((mission) => mission.status === "completed").length;
  const rate = missions.length ? Math.round((completed / missions.length) * 100) : 0;

  if (!missions.length) {
    return (
      <div className="surface-panel p-8 text-center">
        <p className="section-label">
          Today&apos;s Tasks
        </p>
        <p className="mt-4 font-heading text-3xl font-medium text-foreground">
          No tasks scheduled
        </p>
        <p className="mt-3 text-sm leading-6 body-secondary">
          Generate a coach plan to build today&apos;s work around your actual weak areas.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4, duration: 0.7 }}
      className="surface-panel overflow-hidden"
    >
      <div className="flex items-end justify-between gap-4 p-6 pb-5">
        <div>
          <p className="section-label mb-2">
            Today&apos;s Tasks
          </p>
          <p className="font-heading text-4xl font-medium text-foreground">
            {completed}
            <span className="ml-1 text-2xl text-muted-foreground/70">/ {missions.length}</span>
          </p>
        </div>
        <div className="text-right">
          <p className={`font-heading text-4xl font-medium ${rate >= 50 ? "text-foreground" : "text-gradient-blood"}`}>
            {rate}%
          </p>
          <p className="mt-1 text-sm uppercase tracking-[0.18em] text-muted-foreground">
            execution
          </p>
        </div>
      </div>

      <div className="relative h-px bg-border">
        <motion.div
          animate={{ width: `${rate}%` }}
          transition={{ duration: 0.6 }}
          className="absolute left-0 top-0 h-full bg-primary/40"
        />
      </div>

      <div>
        {missions.map((mission, index) => (
          <motion.button
            key={mission.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 + index * 0.06, duration: 0.5 }}
            onClick={() => onToggleMission(mission)}
            type="button"
            disabled={updatingTaskId === mission.id}
            className={`task-row-lift mission-row flex w-full items-center gap-4 border-b border-b-border/60 border-l-2 px-6 py-5 text-left ${
              categoryAccent[mission.category] || "border-l-transparent"
            } ${mission.status === "completed" ? "opacity-55" : ""} ${
              activeTaskId === mission.id && mission.status !== "completed" ? "task-row-active" : ""
            } ${
              updatingTaskId === mission.id ? "cursor-wait" : "cursor-pointer"
            }`}
          >
            <div className={`h-1.5 w-1.5 shrink-0 rounded-full transition-all duration-500 ${
              mission.status === "completed"
                ? "bg-foreground/20"
                : "bg-primary/60 animate-glow-breathe"
            }`} />

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <p className={`font-body text-base font-medium tracking-wide transition-all duration-300 md:text-lg ${
                  mission.status === "completed"
                    ? "line-through text-muted-foreground/70"
                    : "text-foreground"
                }`}>
                  {mission.title}
                </p>
                {mission.referenceUrl && (
                  <a
                    href={mission.referenceUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-sm text-primary/85 transition hover:text-primary"
                  >
                    Open
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <span>{mission.category}</span>
                <span>{formatHoursFromMinutes(mission.estimatedMinutes)}</span>
                <span>{formatDifficulty(mission.difficulty)}</span>
                <span>{mission.referenceLabel || mission.subcategory || mission.weakArea || "Focus"}</span>
              </div>
              {mission.description && (
                <p className={`mt-2 max-w-2xl text-sm leading-6 transition-all duration-300 ${
                  mission.status === "completed"
                    ? "text-muted-foreground/60"
                    : "body-secondary"
                }`}>
                  {mission.description}
                </p>
              )}
            </div>

            <span className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em] transition-colors duration-300 ${
                mission.status === "completed"
                  ? "border-border/70 text-foreground/50"
                  : "border-primary/30 text-primary/90"
              }`}>
              {updatingTaskId === mission.id
                ? "Saving"
                : mission.status === "completed"
                  ? "Completed"
                  : activeTaskId === mission.id
                    ? "Active"
                    : "Mark done"}
            </span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
