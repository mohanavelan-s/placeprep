import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BrainCircuit, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import CoachProfilePanel from "@/components/CoachProfilePanel";
import CountdownTimer from "@/components/CountdownTimer";
import AndroidAccessPanel from "@/components/AndroidAccessPanel";
import DashboardCoachPanel from "@/components/DashboardCoachPanel";
import DashboardDailyTasks from "@/components/DashboardDailyTasks";
import DashboardPowerPocket from "@/components/DashboardPowerPocket";
import DashboardProgressCharts from "@/components/DashboardProgressCharts";
import PageStatusPanel from "@/components/PageStatusPanel";
import SoftSyncNotice from "@/components/SoftSyncNotice";
import StatsGrid from "@/components/StatsGrid";
import XPBar from "@/components/XPBar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
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

export default function DashboardPage() {
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
  const commandLine = latestPlan?.motivationLine || prepPlan?.coachLine || progress?.coachProfile?.commandLine || null;
  const isInitialSync =
    (progressQuery.isPending && !progress)
    || (tasksQuery.isPending && !tasks.length);
  const hasSyncError =
    progressQuery.isError
    || tasksQuery.isError;
  const hasSecondarySyncIssue =
    activeSessionQuery.isError
    || prepPlanQuery.isError;

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

      <div className="grid gap-6">
        <div className="surface-panel flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6">
          <div>
            <p className="section-label">Architect sync</p>
            <p className="mt-2 text-base leading-7 text-foreground/90">
              {prepPlan
                ? `${prepPlan.title || "Your Prep Architect plan"} is active${prepPlan?.targetTopics?.[0] ? ` for ${prepPlan.targetTopics[0]}` : ""}.`
                : "No architect plan yet. Build one to turn weak areas into a structured roadmap."}
            </p>
            {hasSecondarySyncIssue && (
              <p className="mt-3 text-sm leading-6 text-foreground/68">
                Some non-critical live signals are temporarily unavailable. Your core dashboard is still usable, and refresh will retry the missing syncs.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" className="gap-2" onClick={() => void refreshDashboard()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button asChild className="gap-2">
              <Link to="/prep-architect">
                Open Prep Architect
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {isInitialSync && (
          <PageStatusPanel
            eyebrow="Dashboard sync"
            title="Loading your command center."
            description="PlacePrep is restoring progress, tasks, Power Pocket state, and architect context."
            loading
          />
        )}

        {hasSyncError && (
          <SoftSyncNotice
            title="Some live dashboard data is temporarily unavailable."
            description="The command center is still visible with safe defaults. Retry to pull the latest state back in."
            actionLabel="Retry"
            onAction={() => void refreshDashboard()}
          />
        )}

        <CountdownTimer
          placementDate={user?.placementDate}
          focusArea={progress?.coachProfile?.focusArea}
          commandLine={commandLine}
        />

        <DashboardPowerPocket
          activeSession={activeSession}
          suggestedTask={suggestedTask}
          quickTask={latestQuickTask?.task ?? null}
          quickTaskLine={latestQuickTask?.suggestionLine ?? null}
          onStart={() => void handleStartPowerPocket()}
          onEnd={() => activeSession && endSessionMutation.mutate(activeSession.id)}
          isPending={
            quickTaskMutation.isPending
            || startSessionMutation.isPending
            || endSessionMutation.isPending
          }
          onFocusMode={setFocusMode}
        />

        <CoachProfilePanel
          profile={progress?.coachProfile ?? null}
          userName={user?.name || "Operator"}
          targetRole={prepPlan?.targetRole || user?.targetRole || undefined}
        />

        <StatsGrid
          metrics={[
            {
              label: "Readiness",
              value: `${Math.round(progress?.readinessScore ?? 0)}%`,
              helper: "How prepared you look from real delivery.",
            },
            {
              label: "Consistency",
              value: `${Math.round(progress?.consistencyScore ?? 0)}%`,
              helper: "Daily rhythm across the last two weeks.",
            },
            {
              label: "Execution",
              value: `${Math.round(progress?.executionRate ?? 0)}%`,
              helper: "Scheduled work finished on time.",
            },
            {
              label: "Prep Architect",
              value: prepPlan ? "Active" : "Idle",
              helper: prepPlan
                ? `${prepPlan.title || `Version ${prepPlan.version}`} is synced into the system.`
                : "Generate your first personalized plan.",
            },
          ]}
        />

        <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <DashboardDailyTasks
            missions={tasks}
            updatingTaskId={updateTaskMutation.variables?.taskId ?? null}
            onUpdateMissionStatus={handleUpdateMissionStatus}
            activeTaskId={suggestedTask?.id ?? null}
          />

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
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
          <XPBar
            streak={progress?.streak ?? 0}
            missionsCompleted={progress?.missionsCompleted ?? 0}
          />
          <DashboardProgressCharts
            weeklyProgress={progress?.weeklyProgress ?? []}
            topicStrength={progress?.topicStrength ?? []}
          />
        </div>

        <AndroidAccessPanel />
      </div>
    </div>
  );
}
