import { motion } from "framer-motion";
import { ArrowUpRight, CheckCircle2, ListTodo } from "lucide-react";

import TaskStatusControl from "@/components/TaskStatusControl";
import { useLanguage } from "@/context/LanguageContext";
import type { Task, TaskStatus } from "@/lib/api";
import { formatHoursFromMinutes } from "@/lib/time";
import { allowsManualCompletion, getTaskVerificationHint } from "@/lib/task-verification";

const categoryAccent: Record<string, string> = {
  DSA: "border-l-primary/60",
  Core: "border-l-accent/50",
  DBMS: "border-l-accent/50",
  Project: "border-l-foreground/30",
};

interface DashboardDailyTasksProps {
  missions: Task[];
  updatingTaskId?: string | null;
  onUpdateMissionStatus: (task: Task, status: TaskStatus) => void;
  activeTaskId?: string | null;
  onGeneratePlanClick?: () => void;
}

function formatDifficulty(value?: number | null, t?: (text: string) => string) {
  const tr = t || ((s: string) => s);
  if (!value || value <= 2) {
    return tr("Easy");
  }
  if (value >= 4) {
    return tr("Hard");
  }
  return tr("Medium");
}

export default function DashboardDailyTasks({
  missions,
  updatingTaskId,
  onUpdateMissionStatus,
  activeTaskId,
  onGeneratePlanClick,
}: DashboardDailyTasksProps) {
  const { t } = useLanguage();
  const taskList = Array.isArray(missions) ? missions : [];
  const completed = taskList.filter((mission) => mission.status === "completed").length;
  const rate = taskList.length ? Math.round((completed / taskList.length) * 100) : 0;

  if (!taskList.length) {
    return (
      <div className="surface-panel p-6 text-center md:p-7">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ListTodo className="h-5 w-5" />
        </div>
        <p className="section-label mt-3">{t("Today's tasks")}</p>
        <p className="mt-2 font-heading text-xl font-medium text-foreground">
          {t("No tasks scheduled")}
        </p>
        <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-muted-foreground">
          {t("Generate a coach plan to build today's work around your actual weak areas.")}
        </p>
        {onGeneratePlanClick && (
          <button
            type="button"
            onClick={onGeneratePlanClick}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/25 transition"
          >
            <span>{t("Generate Today's Plan")}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="surface-panel overflow-hidden"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between gap-4 border-b border-border/70 p-5 pb-4 md:px-6">
        <div>
          <p className="section-label">{t("Today's tasks")}</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-heading text-3xl font-medium text-foreground">
              {completed}
            </span>
            <span className="text-sm text-muted-foreground">
              / {taskList.length} {t("completed")}
            </span>
          </div>
        </div>

        <div className="text-right">
          <p className="font-heading text-2xl font-medium text-foreground">
            {rate}%
          </p>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {t("Execution")}
          </p>
        </div>
      </div>

      {/* Thin Progress bar */}
      <div className="relative h-1 w-full bg-muted/40">
        <motion.div
          animate={{ width: `${rate}%` }}
          transition={{ duration: 0.5 }}
          className="absolute left-0 top-0 h-full bg-primary/70"
        />
      </div>

      {/* Content-adaptive Task Rows */}
      <div className="divide-y divide-border/60">
        {taskList.map((mission, index) => {
          const isDone = mission.status === "completed";
          const isActive = activeTaskId === mission.id && !isDone;

          return (
            <div
              key={mission.id}
              className={`group flex items-center gap-3.5 border-l-2 p-4 transition-colors hover:bg-muted/15 sm:gap-4 md:px-6 ${
                categoryAccent[mission.category] || "border-l-transparent"
              } ${isDone ? "opacity-60 bg-muted/5" : ""} ${
                isActive ? "bg-primary/[0.04]" : ""
              }`}
            >
              <div
                className={`h-2 w-2 shrink-0 rounded-full ${
                  isDone
                    ? "bg-muted-foreground/30"
                    : isActive
                      ? "bg-primary animate-pulse"
                      : "bg-muted-foreground/50"
                }`}
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={`text-sm font-medium leading-snug transition-all ${
                      isDone
                        ? "line-through text-muted-foreground"
                        : "text-foreground group-hover:text-foreground/95"
                    }`}
                  >
                    {mission.title}
                  </p>

                  {mission.referenceUrl && (
                    <a
                      href={mission.referenceUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex shrink-0 items-center gap-0.5 text-xs text-primary/80 hover:text-primary transition"
                    >
                      <span>{t("Open")}</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{mission.category}</span>
                  <span>•</span>
                  <span>{formatHoursFromMinutes(mission.estimatedMinutes)}</span>
                  <span>•</span>
                  <span>{formatDifficulty(mission.difficulty, t)}</span>
                  {mission.referenceLabel && (
                    <>
                      <span>•</span>
                      <span className="truncate max-w-[140px]">{mission.referenceLabel}</span>
                    </>
                  )}
                </div>

                {getTaskVerificationHint(mission) && (
                  <p className="mt-1 text-[11px] text-muted-foreground/75">
                    {getTaskVerificationHint(mission)}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {isActive && (
                  <span className="hidden sm:inline-flex rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    {t("Active")}
                  </span>
                )}
                <TaskStatusControl
                  status={mission.status}
                  disabled={updatingTaskId === mission.id}
                  compact
                  allowCompletedSelection={allowsManualCompletion(mission)}
                  onChange={(status) => onUpdateMissionStatus(mission, status)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
