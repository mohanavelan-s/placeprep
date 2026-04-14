import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Code2, Github, Globe2, Linkedin, LogOut, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import AuthPanel from "@/components/AuthPanel";
import CoachProfilePanel from "@/components/CoachProfilePanel";
import CountdownTimer from "@/components/CountdownTimer";
import DashboardCoachPanel from "@/components/DashboardCoachPanel";
import DashboardDailyTasks from "@/components/DashboardDailyTasks";
import DashboardPowerPocket from "@/components/DashboardPowerPocket";
import DashboardProgressCharts from "@/components/DashboardProgressCharts";
import PersonalProfilePanel from "@/components/PersonalProfilePanel";
import StatsGrid from "@/components/StatsGrid";
import XPBar from "@/components/XPBar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import {
  endPowerPocket,
  evaluateAiDay,
  fetchActivePowerPocket,
  fetchAiStatus,
  fetchProgressSummary,
  fetchTodayTasks,
  fetchUserProfile,
  generateAiTasks,
  generatePowerPocketTask,
  requestAiHelp,
  saveUserProfile,
  startPowerPocket,
  updateTask,
  type AiEvaluationResult,
  type AiHelpResult,
  type AiQuickTaskResult,
  type AiTaskPlan,
  type Task,
  type TaskStatus,
  type UserProfile,
} from "@/lib/api";

function LoadingState() {
  return (
    <div className="min-h-screen bg-background vignette relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(0_55%_33%_/_0.12),transparent_35%)]" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
          Loading workspace
        </p>
        <h1 className="font-heading text-5xl font-light text-foreground">
          Restoring your PlacePrep session.
        </h1>
      </div>
    </div>
  );
}

function formatDateLabel(value?: string | null) {
  if (!value) {
    return "Date not set";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Date not set";
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getGreeting() {
  const hours = new Date().getHours();
  if (hours < 12) {
    return "Good morning";
  }
  if (hours < 18) {
    return "Good afternoon";
  }
  return "Good evening";
}

export default function Home() {
  const [focusMode, setFocusMode] = useState(false);
  const [latestPlan, setLatestPlan] = useState<AiTaskPlan | null>(null);
  const [latestHelp, setLatestHelp] = useState<AiHelpResult | null>(null);
  const [latestEvaluation, setLatestEvaluation] = useState<AiEvaluationResult | null>(null);
  const [latestQuickTask, setLatestQuickTask] = useState<AiQuickTaskResult | null>(null);
  const queryClient = useQueryClient();
  const { isAuthenticated, isInitializing, login, logout, register, user } = useAuth();

  const progressQuery = useQuery({
    queryKey: ["progress-summary"],
    queryFn: fetchProgressSummary,
    enabled: isAuthenticated,
  });
  const tasksQuery = useQuery({
    queryKey: ["tasks", "today"],
    queryFn: fetchTodayTasks,
    enabled: isAuthenticated,
  });
  const activeSessionQuery = useQuery({
    queryKey: ["power-pocket", "active"],
    queryFn: fetchActivePowerPocket,
    enabled: isAuthenticated,
    refetchInterval: isAuthenticated ? 15000 : false,
  });
  const aiStatusQuery = useQuery({
    queryKey: ["ai-status"],
    queryFn: fetchAiStatus,
    enabled: isAuthenticated,
  });
  const userProfileQuery = useQuery({
    queryKey: ["user-profile"],
    queryFn: fetchUserProfile,
    enabled: isAuthenticated,
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      updateTask(taskId, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks", "today"] });
      void queryClient.invalidateQueries({ queryKey: ["progress-summary"] });
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
  const saveProfileMutation = useMutation({
    mutationFn: (payload: {
      linkedinUrl?: string;
      githubUrl?: string;
      leetcodeUrl?: string;
      portfolioUrl?: string;
      resumeUrl?: string;
    }) => saveUserProfile(payload),
    onSuccess: (result) => {
      queryClient.setQueryData(["user-profile"], result);
      toast.success("Profile links saved.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to save profile links.");
    },
  });

  if (isInitializing) {
    return <LoadingState />;
  }

  if (!isAuthenticated || !user) {
    return <AuthPanel onLogin={login} onRegister={register} />;
  }

  const progress = progressQuery.data;
  const tasks = tasksQuery.data || [];
  const activeSession = activeSessionQuery.data || null;
  const aiStatus = aiStatusQuery.data;
  const userProfile = userProfileQuery.data;
  const suggestedTask =
    tasks.find((task) => task.status !== "completed" && task.status !== "skipped") || null;
  const headerHours = progress?.totalHoursLogged ?? 0;
  const hasDataError = Boolean(
    progressQuery.error
    || tasksQuery.error
    || activeSessionQuery.error
    || aiStatusQuery.error
    || userProfileQuery.error
  );
  const commandLine = latestPlan?.motivationLine || progress?.coachProfile?.commandLine || null;
  const greeting = getGreeting();
  const profileLinks: Array<{
    label: string;
    href?: string | null;
    Icon: typeof Github;
  }> = [
    { label: "GitHub", href: userProfile?.githubUrl, Icon: Github },
    { label: "LinkedIn", href: userProfile?.linkedinUrl, Icon: Linkedin },
    { label: "LeetCode", href: userProfile?.leetcodeUrl, Icon: Code2 },
    { label: "Portfolio", href: userProfile?.portfolioUrl, Icon: Globe2 },
  ].filter((item) => item.href);

  async function refreshDashboard() {
    await Promise.all([
      progressQuery.refetch(),
      tasksQuery.refetch(),
      activeSessionQuery.refetch(),
      aiStatusQuery.refetch(),
      userProfileQuery.refetch(),
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

  function handleEndPowerPocket() {
    if (!activeSession) {
      return;
    }

    endSessionMutation.mutate(activeSession.id);
  }

  return (
    <div className="min-h-screen bg-background vignette relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(0_55%_33%_/_0.14),transparent_26%),radial-gradient(circle_at_85%_15%,hsl(38_40%_38%_/_0.08),transparent_24%)]" />
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

      <header className="relative z-10 border-b border-border/50 bg-background/50 backdrop-blur">
        <div className="container mx-auto flex max-w-7xl flex-col gap-6 px-6 py-5 md:flex-row md:items-end md:justify-between md:px-8">
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.32em] text-muted-foreground">
              PlacePrep / Private prep command center
            </p>
            <h1 className="font-heading text-4xl font-medium tracking-wide text-foreground md:text-5xl">
              {greeting}, {user.name}
            </h1>
            <p className="mt-2 text-base leading-7 text-muted-foreground">
              PlacePrep is live. Target role: {user.targetRole || "Placement prep"}.
            </p>
          </div>

          <div className="flex flex-col items-start gap-4 md:items-end">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-2 text-xs uppercase tracking-[0.2em] text-primary">
                <Activity className="h-3.5 w-3.5" />
                {aiStatus?.aiEnabled ? "AI Live" : "Fallback Mode"}
              </div>
              {aiStatus && (
                <div className="rounded-full border border-border/80 px-3 py-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {aiStatus.reason}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => void refreshDashboard()}
                disabled={progressQuery.isFetching || tasksQuery.isFetching || activeSessionQuery.isFetching}
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={logout}>
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>

            {profileLinks.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {profileLinks.map(({ label, href, Icon }) => (
                  <a
                    key={label}
                    href={href || undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="coach-chip inline-flex items-center gap-2 hover:border-primary/30 hover:text-foreground"
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </a>
                ))}
              </div>
            )}

            <p className="text-sm uppercase tracking-[0.16em] text-muted-foreground">
              {progress?.streak ?? 0}d streak / {headerHours.toFixed(1)}h logged / placement {formatDateLabel(user.placementDate)}
            </p>
          </div>
        </div>
      </header>

      <main className="relative z-10 container mx-auto max-w-7xl px-6 md:px-8">
        {hasDataError && (
          <div className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground">
            One or more dashboard sections could not load from the backend. Use refresh to retry.
          </div>
        )}

        <CountdownTimer
          placementDate={user.placementDate}
          focusArea={progress?.coachProfile?.focusArea}
          commandLine={commandLine}
        />

        <div className="pb-6">
          <DashboardPowerPocket
            activeSession={activeSession}
            suggestedTask={suggestedTask}
            quickTask={latestQuickTask?.task ?? null}
            quickTaskLine={latestQuickTask?.suggestionLine ?? null}
            onStart={() => void handleStartPowerPocket()}
            onEnd={handleEndPowerPocket}
            isPending={
              quickTaskMutation.isPending
              || startSessionMutation.isPending
              || endSessionMutation.isPending
            }
            onFocusMode={setFocusMode}
          />
        </div>

        <div className="pb-6">
          <CoachProfilePanel
            profile={progress?.coachProfile ?? null}
            userName={user.name}
            targetRole={user.targetRole}
          />
        </div>

        <div className="pb-8">
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
                label: "Focus Score",
                value: Math.round(progress?.focusScore ?? 0),
                helper: "Blend of productivity and task follow-through.",
              },
            ]}
          />
        </div>

        <div className="grid gap-6 pb-8 xl:grid-cols-[1.08fr_0.92fr]">
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

        <div className="grid gap-6 pb-8 xl:grid-cols-[0.78fr_1.22fr]">
          <XPBar
            streak={progress?.streak ?? 0}
            missionsCompleted={progress?.missionsCompleted ?? 0}
          />

          <DashboardProgressCharts
            weeklyProgress={progress?.weeklyProgress ?? []}
            topicStrength={progress?.topicStrength ?? []}
          />
        </div>

        <div className="pb-8">
          <PersonalProfilePanel
            profile={userProfile as UserProfile | null}
            isSaving={saveProfileMutation.isPending}
            onSave={saveProfileMutation.mutateAsync}
          />
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 1 }}
          className="py-16 pb-24 text-center"
        >
          <div className="soft-divider mx-auto mb-8 h-px w-24" />
          <p className="font-heading text-xl font-medium italic tracking-wide text-muted-foreground/70">
            Stay locked in.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
