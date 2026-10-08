import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Flame,
  Gauge,
  Milestone,
  RefreshCw,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import CoachProfilePanel from "@/components/CoachProfilePanel";
import DashboardCoachPanel from "@/components/DashboardCoachPanel";
import DashboardDailyTasks from "@/components/DashboardDailyTasks";
import DashboardPowerPocket from "@/components/DashboardPowerPocket";
import DashboardProgressCharts from "@/components/DashboardProgressCharts";
import SoftSyncNotice from "@/components/SoftSyncNotice";
import { DashboardSkeleton } from "@/components/WorkspaceSkeletons";
import XPBar from "@/components/XPBar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useQueryErrorLogger } from "@/hooks/use-query-error-logger";
import {
  endPowerPocket,
  evaluateAiDay,
  fetchActivePowerPocket,
  fetchProgressSummary,
  fetchTodayTasks,
  fetchLatestPrepPlan,
  generateAiTasks,
  generatePowerPocketTask,
  requestAiHelp,
  startPowerPocket,
  updateTask,
  type AiEvaluationResult,
  type AiHelpResult,
  type AiQuickTaskResult,
  type AiTaskPlan,
  type Task,
  type TaskStatus,
} from "@/lib/api";

function calculateDaysLeft(placementDate?: string | null): number {
  if (!placementDate) return 30;
  const target = new Date(placementDate).getTime();
  if (isNaN(target)) return 30;
  return Math.max(0, Math.ceil((target - Date.now()) / (1000 * 60 * 60 * 24)));
}

export default function DashboardPage() {
  const { t } = useLanguage();
  const [focusMode, setFocusMode] = useState(false);
  const [latestPlan, setLatestPlan] = useState<AiTaskPlan | null>(null);
  const [latestHelp, setLatestHelp] = useState<AiHelpResult | null>(null);
  const [latestEvaluation, setLatestEvaluation] = useState<AiEvaluationResult | null>(null);
  const [latestQuickTask, setLatestQuickTask] = useState<AiQuickTaskResult | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const progressQuery = useQuery({
    queryKey: ["progress-summary"],
    queryFn: fetchProgressSummary,
  });
  const tasksQuery = useQuery({
    queryKey: ["tasks", "today"],
    queryFn: fetchTodayTasks,
  });
  const activeSessionQuery = useQuery({
    queryKey: ["power-pocket", "active"],
    queryFn: fetchActivePowerPocket,
    refetchInterval: 15000,
  });
  const prepPlanQuery = useQuery({
    queryKey: ["prep-plan", "latest"],
    queryFn: fetchLatestPrepPlan,
  });

  useQueryErrorLogger("DashboardPage:progress-summary", progressQuery.error);
  useQueryErrorLogger("DashboardPage:today-tasks", tasksQuery.error);
  useQueryErrorLogger("DashboardPage:power-pocket", activeSessionQuery.error);
  useQueryErrorLogger("DashboardPage:prep-plan", prepPlanQuery.error);

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      updateTask(taskId, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks", "today"] });
      void queryClient.invalidateQueries({ queryKey: ["progress-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to update task.");
    },
  });

  const startSessionMutation = useMutation({
    mutationFn: (payload: {
      taskId?: string;
      title?: string;
      notes?: string;
      source?: "manual" | "suggested" | "ai";
    }) => startPowerPocket(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["power-pocket", "active"] });
      void queryClient.invalidateQueries({ queryKey: ["progress-summary"] });
      toast.success("Power Pocket session started.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to start Power Pocket.");
    },
  });

  const endSessionMutation = useMutation({
    mutationFn: (sessionId: string) => endPowerPocket(sessionId, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["power-pocket", "active"] });
      void queryClient.invalidateQueries({ queryKey: ["progress-summary"] });
      toast.success("Power Pocket session completed.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to end Power Pocket.");
    },
  });

  const generatePlanMutation = useMutation({
    mutationFn: (payload: {
      availableMinutes: number;
      persist: boolean;
      replaceExisting: boolean;
    }) => generateAiTasks(payload),
    onSuccess: (result) => {
      setLatestPlan(result);
      void queryClient.invalidateQueries({ queryKey: ["tasks", "today"] });
      void queryClient.invalidateQueries({ queryKey: ["progress-summary"] });
      toast.success("Today's AI plan has been deployed.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to generate today's plan.");
    },
  });

  const helpMutation = useMutation({
    mutationFn: (payload: { problemName: string; attempt: string }) => requestAiHelp(payload),
    onSuccess: (result) => {
      setLatestHelp(result);
      toast.success("Coach guidance is ready.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to generate guidance.");
    },
  });

  const evaluateMutation = useMutation({
    mutationFn: (payload: {
      tasks: Array<Pick<Task, "title" | "status" | "weakArea" | "subcategory" | "category">>;
      totalTasks: number;
      tasksCompleted: number;
      timeSpentMinutes: number;
      struggles: string;
      persistLog: boolean;
    }) => evaluateAiDay(payload),
    onSuccess: (result) => {
      setLatestEvaluation(result);
      void queryClient.invalidateQueries({ queryKey: ["progress-summary"] });
      toast.success("Today's evaluation has been recorded.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to evaluate today's work.");
    },
  });

  const quickTaskMutation = useMutation({
    mutationFn: (availableMinutes: number) => generatePowerPocketTask({ availableMinutes }),
    onSuccess: (result) => {
      setLatestQuickTask(result);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to build a Power Pocket task.");
    },
  });

  const progress = progressQuery.data;
  const tasks = Array.isArray(tasksQuery.data) ? tasksQuery.data : [];
  const activeSession = activeSessionQuery.data || null;
  const prepPlan = prepPlanQuery.data ?? null;
  const suggestedTask =
    tasks.find((task) => task.status !== "completed" && task.status !== "skipped") || null;
  const commandLine =
    latestPlan?.motivationLine ||
    prepPlan?.coachLine ||
    progress?.coachProfile?.commandLine ||
    null;

  const isInitialSync =
    (progressQuery.isPending && !progress) ||
    (tasksQuery.isPending && !tasks.length);
  const hasSyncError = progressQuery.isError || tasksQuery.isError;
  const hasSecondarySyncIssue = activeSessionQuery.isError || prepPlanQuery.isError;

  const daysLeft = calculateDaysLeft(user?.placementDate);
  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const executionRate = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;

  async function refreshDashboard() {
    await Promise.all([
      progressQuery.refetch(),
      tasksQuery.refetch(),
      activeSessionQuery.refetch(),
      prepPlanQuery.refetch(),
    ]);
    toast.success("Dashboard refreshed.");
  }

  function handleUpdateMissionStatus(task: Task, status: TaskStatus) {
    updateTaskMutation.mutate({
      taskId: task.id,
      status,
    });
  }

  async function handleStartPowerPocket() {
    let nextQuickTask = latestQuickTask;

    if (!nextQuickTask) {
      try {
        nextQuickTask = await quickTaskMutation.mutateAsync(30);
      } catch {
        nextQuickTask = null;
      }
    }

    if (nextQuickTask) {
      startSessionMutation.mutate({
        title: nextQuickTask.task.title,
        notes: nextQuickTask.task.reason,
        source: "ai",
      });
      return;
    }

    startSessionMutation.mutate({
      taskId: suggestedTask?.id,
      title: suggestedTask?.title,
      source: suggestedTask ? "suggested" : "manual",
    });
  }

  if (isInitialSync) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="relative">
      <AnimatePresence>
        {focusMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="focus-mode-overlay"
          />
        )}
      </AnimatePresence>

      <div className="space-y-6">
        {/* 1. TODAY / CONTEXT HEADER */}
        <div className="surface-panel overflow-hidden p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-semibold uppercase tracking-wider text-primary">
                  {t("Command Chamber")}
                </span>
                <span>•</span>
                <span>{new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</span>
                <span>•</span>
                <span className="text-foreground/80">{user?.name || "Operator"}</span>
              </div>

              <h1 className="mt-1.5 font-heading text-2xl font-medium tracking-tight text-foreground md:text-3xl">
                {t("Hold the line until placement day.")}
              </h1>

              {commandLine && (
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground md:text-sm">
                  {commandLine}
                </p>
              )}
            </div>

            {/* Quick Context Actions & Status Pills */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Target Lane Pill */}
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/60 px-3 py-1.5 text-xs text-foreground/85">
                <Target className="h-3.5 w-3.5 text-primary" />
                <span>{prepPlan?.targetRole || user?.targetRole || "Placement Preparation"}</span>
              </div>

              {/* Countdown Pill */}
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/60 px-3 py-1.5 text-xs text-foreground/85">
                <Milestone className="h-3.5 w-3.5 text-accent" />
                <span className="font-semibold text-foreground">{daysLeft}</span>
                <span className="text-muted-foreground">{t("Days Remaining")}</span>
              </div>

              {/* Refresh Action */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 px-3 text-xs"
                onClick={() => void refreshDashboard()}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t("Refresh")}
              </Button>

              {/* Prep Architect Quick Link */}
              <Button asChild size="sm" className="h-8 gap-1.5 px-3 text-xs">
                <Link to="/prep-architect">
                  <span>{t("Prep Architect")}</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </div>

          {hasSecondarySyncIssue && (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground/80 border-t border-border/50 pt-2.5">
              Some non-critical live telemetry signals are temporarily calibrating. Core execution workspace is fully functional.
            </p>
          )}
        </div>

        {hasSyncError && (
          <SoftSyncNotice
            title="Some live dashboard data is temporarily unavailable."
            description="The command center is still visible with safe defaults. Retry to pull the latest state back in."
            actionLabel="Retry"
            onAction={() => void refreshDashboard()}
          />
        )}

        {/* 2. EXECUTION SUMMARY (COMPACT 4-METRIC RIBBON) */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-border/70 bg-card/60 p-4 transition-colors hover:border-border">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium uppercase tracking-wider">{t("Readiness")}</span>
              <Gauge className="h-3.5 w-3.5 text-primary/80" />
            </div>
            <p className="mt-2 font-heading text-3xl font-medium text-foreground">
              {Math.round(progress?.readinessScore ?? 0)}%
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground/80">Diagnostic benchmark</p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/60 p-4 transition-colors hover:border-border">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium uppercase tracking-wider">{t("Consistency")}</span>
              <Zap className="h-3.5 w-3.5 text-accent/80" />
            </div>
            <p className="mt-2 font-heading text-3xl font-medium text-foreground">
              {Math.round(progress?.consistencyScore ?? 0)}%
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground/80">14-day study rhythm</p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/60 p-4 transition-colors hover:border-border">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium uppercase tracking-wider">{t("Execution")}</span>
              <Sparkles className="h-3.5 w-3.5 text-emerald-500/80" />
            </div>
            <p className="mt-2 font-heading text-3xl font-medium text-foreground">
              {executionRate}%
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground/80">
              {completedCount} / {tasks.length} {t("Today's tasks")}
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/60 p-4 transition-colors hover:border-border">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium uppercase tracking-wider">{t("Streak")}</span>
              <Flame className="h-3.5 w-3.5 text-primary/80" />
            </div>
            <p className="mt-2 font-heading text-3xl font-medium text-foreground">
              {progress?.streak ?? 0}
              <span className="ml-1 text-sm font-normal text-muted-foreground">days</span>
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground/80">
              {progress?.missionsCompleted ?? 0} total solved
            </p>
          </div>
        </div>

        {/* 3 & 4. PRIMARY AREA: NEXT BEST ACTION (POWER POCKET) & TODAY'S TASKS */}
        <div className="space-y-4">
          {/* Next Best Action / Power Pocket Sprint */}
          <DashboardPowerPocket
            activeSession={activeSession}
            suggestedTask={suggestedTask}
            quickTask={latestQuickTask?.task ?? null}
            quickTaskLine={latestQuickTask?.suggestionLine ?? null}
            onStart={() => void handleStartPowerPocket()}
            onEnd={() => activeSession && endSessionMutation.mutate(activeSession.id)}
            isPending={
              quickTaskMutation.isPending ||
              startSessionMutation.isPending ||
              endSessionMutation.isPending
            }
            onFocusMode={setFocusMode}
          />

          {/* Today's Tasks (Content-Adaptive) */}
          <DashboardDailyTasks
            missions={tasks}
            updatingTaskId={updateTaskMutation.variables?.taskId ?? null}
            onUpdateMissionStatus={handleUpdateMissionStatus}
            activeTaskId={suggestedTask?.id ?? null}
            onGeneratePlanClick={() => {
              void generatePlanMutation.mutateAsync({
                availableMinutes: 150,
                persist: true,
                replaceExisting: true,
              });
            }}
          />
        </div>

        {/* 5. SECONDARY AREA: COACH CONSOLE (RESCUE, PLAN, REVIEW) */}
        <DashboardCoachPanel
          profile={progress?.coachProfile ?? null}
          todayTasks={tasks}
          latestPlan={latestPlan}
          latestHelp={latestHelp}
          latestEvaluation={latestEvaluation}
          onGeneratePlan={generatePlanMutation.mutateAsync}
          onRequestHelp={helpMutation.mutateAsync}
          onEvaluateDay={evaluateMutation.mutateAsync}
          isGenerating={generatePlanMutation.isPending}
          isHelping={helpMutation.isPending}
          isEvaluating={evaluateMutation.isPending}
        />

        {/* 6. SECONDARY SIGNALS: COACH PROFILE & METRICS */}
        <div className="space-y-6">
          <CoachProfilePanel
            profile={progress?.coachProfile ?? null}
            userName={user?.name || "Operator"}
            targetRole={prepPlan?.targetRole || user?.targetRole || undefined}
          />

          <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
            <XPBar
              streak={progress?.streak ?? 0}
              missionsCompleted={progress?.missionsCompleted ?? 0}
            />
            <DashboardProgressCharts
              weeklyProgress={progress?.weeklyProgress ?? []}
              topicStrength={progress?.topicStrength ?? []}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
