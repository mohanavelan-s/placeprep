import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, WandSparkles, NotebookPen } from "lucide-react";

import HoursInput from "@/components/HoursInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  AiEvaluationResult,
  AiHelpResult,
  AiTaskPlan,
  CoachProfile,
  Task,
} from "@/lib/api";
import { formatHoursFromMinutes, parseHoursToMinutes } from "@/lib/time";

interface DashboardCoachPanelProps {
  profile?: CoachProfile | null;
  todayTasks: Task[];
  latestPlan?: AiTaskPlan | null;
  latestHelp?: AiHelpResult | null;
  latestEvaluation?: AiEvaluationResult | null;
  onGeneratePlan: (payload: {
    availableMinutes: number;
    persist: boolean;
    replaceExisting: boolean;
  }) => Promise<unknown>;
  onRequestHelp: (payload: {
    problemName: string;
    attempt: string;
  }) => Promise<unknown>;
  onEvaluateDay: (payload: {
    tasks: Array<Pick<Task, "title" | "status" | "weakArea" | "subcategory" | "category">>;
    totalTasks: number;
    tasksCompleted: number;
    timeSpentMinutes: number;
    struggles: string;
    persistLog: boolean;
  }) => Promise<unknown>;
  isGenerating?: boolean;
  isHelping?: boolean;
  isEvaluating?: boolean;
}

export default function DashboardCoachPanel({
  profile,
  todayTasks,
  latestPlan,
  latestHelp,
  latestEvaluation,
  onGeneratePlan,
  onRequestHelp,
  onEvaluateDay,
  isGenerating = false,
  isHelping = false,
  isEvaluating = false,
}: DashboardCoachPanelProps) {
  const [availableHours, setAvailableHours] = useState("2.5");
  const [problemName, setProblemName] = useState("");
  const [attempt, setAttempt] = useState("");
  const [timeSpentHours, setTimeSpentHours] = useState("2.5");
  const [struggles, setStruggles] = useState("");

  const completedToday = todayTasks.filter((task) => task.status === "completed").length;

  async function handleGeneratePlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onGeneratePlan({
      availableMinutes: parseHoursToMinutes(availableHours, 150),
      persist: true,
      replaceExisting: true,
    });
  }

  async function handleHelp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!problemName.trim()) {
      return;
    }

    await onRequestHelp({
      problemName: problemName.trim(),
      attempt: attempt.trim(),
    });
  }

  async function handleEvaluate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onEvaluateDay({
      tasks: todayTasks.map((task) => ({
        title: task.title,
        status: task.status,
        weakArea: task.weakArea,
        subcategory: task.subcategory,
        category: task.category,
      })),
      totalTasks: todayTasks.length,
      tasksCompleted: completedToday,
      timeSpentMinutes: parseHoursToMinutes(timeSpentHours, 0),
      struggles: struggles.trim(),
      persistLog: true,
    });
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12, duration: 0.7 }}
      className="surface-panel p-6 md:p-7"
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="section-label">Coach Console</p>
          <h3 className="mt-2 font-heading text-3xl font-medium text-foreground">
            Personal planning, rescue, and daily review.
          </h3>
        </div>
        <div className="rounded-full border border-border/80 px-3 py-1.5 text-xs uppercase tracking-[0.22em] text-muted-foreground">
          {profile?.focusArea || "Calibrating"}
        </div>
      </div>

      <div className="space-y-6">
        <form onSubmit={handleGeneratePlan} className="rounded-2xl border border-border/80 bg-card/70 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="section-label">Generate Today&apos;s Plan</p>
              <p className="mt-2 text-sm leading-6 body-secondary">
                The coach will build 2 DSA tasks, 1 revision task, and 1 project task around your weak areas and current consistency.
              </p>
            </div>
            <div className="w-full max-w-[160px]">
              <HoursInput
                min={1}
                max={4}
                value={availableHours}
                onChange={(event) => setAvailableHours(event.target.value)}
                placeholder="2.5 hrs"
                className="h-11 border-border/80 bg-background/70 text-base"
              />
            </div>
          </div>

          <Button type="submit" className="mt-4 h-11 w-full justify-center md:w-auto" disabled={isGenerating}>
            <Sparkles className="h-4 w-4" />
            {isGenerating ? "Generating plan..." : "Generate and deploy plan"}
          </Button>

          {latestPlan && (
            <div className="mt-5 rounded-2xl border border-border/80 bg-background/40 p-4">
              <p className="text-sm font-medium text-foreground">{latestPlan.motivationLine}</p>
              <div className="mt-4 space-y-3">
                {latestPlan.tasks.map((task) => (
                  <div key={task.id} className="rounded-xl border border-border/70 bg-card/70 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-medium text-foreground">{task.title}</p>
                        <p className="mt-1 text-sm body-secondary">
                          {task.category} / {formatHoursFromMinutes(task.estimatedMinutes)} / {task.referenceLabel || task.weakArea || "Focus"}
                        </p>
                      </div>
                      <span className="coach-chip">{task.difficulty ? `D${task.difficulty}` : "D3"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>

        <form onSubmit={handleHelp} className="rounded-2xl border border-border/80 bg-card/70 p-5">
          <div className="flex items-start gap-3">
            <WandSparkles className="mt-1 h-5 w-5 text-primary/85" />
            <div className="flex-1">
              <p className="section-label">I&apos;m Stuck</p>
              <p className="mt-2 text-sm leading-6 body-secondary">
                Ask for a hint, an approach path, similar problems, and search keywords without getting the full solution handed to you.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4">
            <Input
              value={problemName}
              onChange={(event) => setProblemName(event.target.value)}
              placeholder="Problem name or topic"
              className="h-11 border-border/80 bg-background/70 text-base"
            />
            <Textarea
              value={attempt}
              onChange={(event) => setAttempt(event.target.value)}
              placeholder="What have you tried? Where exactly are you blocked?"
              className="min-h-[120px] border-border/80 bg-background/70 text-sm leading-6"
            />
          </div>

          <Button type="submit" className="mt-4 h-11 w-full justify-center md:w-auto" disabled={isHelping}>
            {isHelping ? "Thinking..." : "Coach me through it"}
          </Button>

          {latestHelp && (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border/80 bg-background/40 p-4 md:col-span-2">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Hint</p>
                <p className="mt-2 text-sm leading-6 text-foreground/90">{latestHelp.hint}</p>
              </div>

              <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Approach</p>
                <div className="mt-3 space-y-2">
                  {latestHelp.approachSteps.map((step) => (
                    <p key={step} className="text-sm leading-6 body-secondary">
                      {step}
                    </p>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Practice Next</p>
                <div className="mt-3 space-y-2">
                  {latestHelp.similarProblems.map((item) => (
                    <p key={item} className="text-sm leading-6 body-secondary">
                      {item}
                    </p>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {latestHelp.youtubeSearchKeywords.map((item) => (
                    <span key={item} className="coach-chip">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </form>

        <form onSubmit={handleEvaluate} className="rounded-2xl border border-border/80 bg-card/70 p-5">
          <div className="flex items-start gap-3">
            <NotebookPen className="mt-1 h-5 w-5 text-accent/90" />
            <div className="flex-1">
              <p className="section-label">Evaluate Today</p>
              <p className="mt-2 text-sm leading-6 body-secondary">
                Score the day, surface weak areas, and write tomorrow&apos;s correction back into the system.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[190px_1fr]">
            <HoursInput
              min={0}
              max={12}
              value={timeSpentHours}
              onChange={(event) => setTimeSpentHours(event.target.value)}
              placeholder="3 hrs"
              className="h-11 border-border/80 bg-background/70 text-base"
            />
            <Textarea
              value={struggles}
              onChange={(event) => setStruggles(event.target.value)}
              placeholder="Where did the day slip? What slowed you down?"
              className="min-h-[120px] border-border/80 bg-background/70 text-sm leading-6"
            />
          </div>

          <Button type="submit" className="mt-4 h-11 w-full justify-center md:w-auto" disabled={isEvaluating}>
            {isEvaluating ? "Evaluating..." : "Run daily evaluation"}
          </Button>

          {latestEvaluation && (
            <div className="mt-5 rounded-2xl border border-border/80 bg-background/40 p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    Productivity score
                  </p>
                  <p className="mt-2 font-heading text-5xl font-medium text-foreground">
                    {latestEvaluation.productivityScore}
                  </p>
                </div>
                <p className="max-w-xl text-sm leading-6 text-foreground/85">
                  {latestEvaluation.verdict}
                </p>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Weak areas</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {latestEvaluation.weakAreas.map((item) => (
                      <span key={item} className="coach-chip border-primary/30">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Fix tomorrow</p>
                  <div className="mt-3 space-y-2">
                    {latestEvaluation.tomorrowImprovements.map((item) => (
                      <p key={item} className="text-sm leading-6 body-secondary">
                        {item}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </motion.section>
  );
}
