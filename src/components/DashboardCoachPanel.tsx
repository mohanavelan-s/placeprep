import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Compass,
  Lightbulb,
  NotebookPen,
  Sparkles,
  WandSparkles,
  CheckCircle2,
  ListOrdered,
  BookOpen,
  Search,
} from "lucide-react";

import HoursInput from "@/components/HoursInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/context/LanguageContext";
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

type CoachTab = "rescue" | "plan" | "review";

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
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<CoachTab>("rescue");
  const [availableHours, setAvailableHours] = useState("2.5");
  const [problemName, setProblemName] = useState("");
  const [attempt, setAttempt] = useState("");
  const [timeSpentHours, setTimeSpentHours] = useState("2.5");
  const [struggles, setStruggles] = useState("");

  // Auto-switch tab when fresh results arrive
  useEffect(() => {
    if (latestHelp) {
      setActiveTab("rescue");
    }
  }, [latestHelp]);

  useEffect(() => {
    if (latestPlan) {
      setActiveTab("plan");
    }
  }, [latestPlan]);

  useEffect(() => {
    if (latestEvaluation) {
      setActiveTab("review");
    }
  }, [latestEvaluation]);

  const completedToday = Array.isArray(todayTasks)
    ? todayTasks.filter((task) => task.status === "completed").length
    : 0;

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
    const tasksArray = Array.isArray(todayTasks) ? todayTasks : [];
    await onEvaluateDay({
      tasks: tasksArray.map((task) => ({
        title: task.title,
        status: task.status,
        weakArea: task.weakArea,
        subcategory: task.subcategory,
        category: task.category,
      })),
      totalTasks: tasksArray.length,
      tasksCompleted: completedToday,
      timeSpentMinutes: parseHoursToMinutes(timeSpentHours, 0),
      struggles: struggles.trim(),
      persistLog: true,
    });
  }

  // Safe extraction of all arrays and values to guarantee zero crashes
  const planTasks = Array.isArray(latestPlan?.tasks)
    ? latestPlan.tasks
    : Array.isArray(latestPlan)
      ? (latestPlan as Task[])
      : [];

  const hint = latestHelp?.hint || (latestHelp as unknown as { hints?: string })?.hints || "";
  const approachSteps = Array.isArray(latestHelp?.approachSteps) ? latestHelp.approachSteps : [];
  const similarProblems = Array.isArray(latestHelp?.similarProblems) ? latestHelp.similarProblems : [];
  const youtubeSearchKeywords = Array.isArray(latestHelp?.youtubeSearchKeywords)
    ? latestHelp.youtubeSearchKeywords
    : [];

  const weakAreas = Array.isArray(latestEvaluation?.weakAreas) ? latestEvaluation.weakAreas : [];
  const tomorrowImprovements = Array.isArray(latestEvaluation?.tomorrowImprovements)
    ? latestEvaluation.tomorrowImprovements
    : [];
  const productivityScore =
    latestEvaluation?.productivityScore ??
    (latestEvaluation as unknown as { score?: number })?.score ??
    0;
  const verdict =
    latestEvaluation?.verdict ||
    (latestEvaluation as unknown as { evaluation?: string })?.evaluation ||
    "";

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.6 }}
      className="surface-panel overflow-hidden p-5 md:p-6"
    >
      {/* Header with coherent segmented tabs */}
      <div className="flex flex-col gap-4 border-b border-border/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="section-label">{t("Coach Console")}</p>
          <h3 className="mt-1 font-heading text-2xl font-medium text-foreground">
            {activeTab === "rescue" && t("I'm Stuck")}
            {activeTab === "plan" && t("Generate Today's Plan")}
            {activeTab === "review" && t("Evaluate Today")}
          </h3>
        </div>

        {/* Segmented Mode Selector */}
        <div className="flex items-center gap-1 rounded-xl border border-border/80 bg-background/80 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("rescue")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              activeTab === "rescue"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <WandSparkles className="h-3.5 w-3.5" />
            <span>{t("Rescue")}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("plan")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              activeTab === "plan"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{t("Plan")}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("review")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              activeTab === "review"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <NotebookPen className="h-3.5 w-3.5" />
            <span>{t("Review")}</span>
          </button>
        </div>
      </div>

      <div className="pt-5">
        <AnimatePresence mode="wait">
          {/* TAB 1: RESCUE ("I'M STUCK") */}
          {activeTab === "rescue" && (
            <motion.div
              key="rescue"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              <form onSubmit={handleHelp} className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  {t("Ask for progressive hints and structured approach steps without revealing the full solution.")}
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {t("Problem name or topic")}
                    </label>
                    <Input
                      value={problemName}
                      onChange={(event) => setProblemName(event.target.value)}
                      placeholder={t("Problem name or topic")}
                      className="h-10 border-border/80 bg-background/60 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {t("What have you tried? Where exactly are you blocked?")}
                    </label>
                    <Textarea
                      value={attempt}
                      onChange={(event) => setAttempt(event.target.value)}
                      placeholder={t("What have you tried? Where exactly are you blocked?")}
                      className="min-h-[90px] border-border/80 bg-background/60 text-sm leading-relaxed"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <Button
                    type="submit"
                    disabled={isHelping || !problemName.trim()}
                    className="gap-2"
                  >
                    <WandSparkles className="h-4 w-4" />
                    {isHelping ? t("Analyzing problem...") : t("Coach me through it")}
                  </Button>

                  {profile?.focusArea && (
                    <span className="text-xs text-muted-foreground">
                      {t("Focus Area")}: <span className="text-foreground">{profile.focusArea}</span>
                    </span>
                  )}
                </div>

                {/* Render guidance cleanly with zero crash risks */}
                {latestHelp && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-5 space-y-3 rounded-2xl border border-primary/20 bg-background/40 p-4"
                  >
                    {/* Progressive Hint */}
                    {hint && (
                      <div className="rounded-xl border border-border/70 bg-card/60 p-3.5">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                          <Lightbulb className="h-3.5 w-3.5" />
                          <span>{t("Progressive Hint")}</span>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-foreground/95">{hint}</p>
                      </div>
                    )}

                    {/* Approach Steps */}
                    {approachSteps.length > 0 && (
                      <div className="rounded-xl border border-border/70 bg-card/60 p-3.5">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          <ListOrdered className="h-3.5 w-3.5" />
                          <span>{t("Approach Steps")}</span>
                        </div>
                        <div className="mt-2 space-y-1.5">
                          {approachSteps.map((step, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs leading-relaxed text-foreground/80">
                              <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                                {idx + 1}
                              </span>
                              <span>{step}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Similar Problems */}
                    {similarProblems.length > 0 && (
                      <div className="rounded-xl border border-border/70 bg-card/60 p-3.5">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          <BookOpen className="h-3.5 w-3.5" />
                          <span>{t("Recommended Practice")}</span>
                        </div>
                        <div className="mt-2 space-y-1">
                          {similarProblems.map((prob, idx) => (
                            <p key={idx} className="text-xs text-foreground/80">
                              • {prob}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Search Keywords */}
                    {youtubeSearchKeywords.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <Search className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground mr-1">{t("Search Keywords")}:</span>
                        {youtubeSearchKeywords.map((tag, idx) => (
                          <span
                            key={idx}
                            className="rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </form>
            </motion.div>
          )}

          {/* TAB 2: PLAN ("GENERATE TODAY'S PLAN") */}
          {activeTab === "plan" && (
            <motion.div
              key="plan"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              <form onSubmit={handleGeneratePlan} className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  {t("The coach will build 2 DSA tasks, 1 revision task, and 1 project task around your weak areas and current consistency.")}
                </p>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="w-full sm:w-44">
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {t("Time per day")}
                    </label>
                    <HoursInput
                      min={1}
                      max={6}
                      value={availableHours}
                      onChange={(event) => setAvailableHours(event.target.value)}
                      placeholder="2.5 hrs"
                      className="h-10 border-border/80 bg-background/60 text-sm"
                    />
                  </div>

                  <div className="sm:pt-5">
                    <Button type="submit" disabled={isGenerating} className="gap-2">
                      <Sparkles className="h-4 w-4" />
                      {isGenerating ? t("Generating plan...") : t("Generate and deploy plan")}
                    </Button>
                  </div>
                </div>

                {latestPlan && (
                  <div className="mt-4 rounded-xl border border-border/70 bg-background/40 p-3.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                      {latestPlan.planTitle || t("Generated Plan")}
                    </p>
                    {latestPlan.motivationLine && (
                      <p className="mt-1 text-xs text-muted-foreground">{latestPlan.motivationLine}</p>
                    )}

                    {planTasks.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {planTasks.map((task) => (
                          <div
                            key={task.id || task.title}
                            className="flex items-center justify-between rounded-lg border border-border/50 bg-card/60 px-3 py-2 text-xs"
                          >
                            <span className="font-medium text-foreground">{task.title}</span>
                            <span className="text-muted-foreground">
                              {task.category} • {formatHoursFromMinutes(task.estimatedMinutes)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </form>
            </motion.div>
          )}

          {/* TAB 3: REVIEW ("EVALUATE TODAY") */}
          {activeTab === "review" && (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              <form onSubmit={handleEvaluate} className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  {t("Score your daily delivery, isolate weak areas, and tune tomorrow's plan.")}
                </p>

                <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {t("Hours studied")}
                    </label>
                    <HoursInput
                      min={0}
                      max={14}
                      value={timeSpentHours}
                      onChange={(event) => setTimeSpentHours(event.target.value)}
                      placeholder="2.5 hrs"
                      className="h-10 border-border/80 bg-background/60 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {t("Struggles / friction")}
                    </label>
                    <Textarea
                      value={struggles}
                      onChange={(event) => setStruggles(event.target.value)}
                      placeholder={t("Where did the day slip? What slowed you down?")}
                      className="min-h-[80px] border-border/80 bg-background/60 text-sm leading-relaxed"
                    />
                  </div>
                </div>

                <Button type="submit" disabled={isEvaluating} className="gap-2">
                  <NotebookPen className="h-4 w-4" />
                  {isEvaluating ? t("Evaluating...") : t("Run daily evaluation")}
                </Button>

                {latestEvaluation && (
                  <div className="mt-4 rounded-xl border border-border/70 bg-background/40 p-3.5">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("Productivity score")}
                      </span>
                      <span className="font-heading text-xl font-bold text-foreground">
                        {productivityScore}%
                      </span>
                    </div>

                    {verdict && <p className="mt-2 text-xs leading-relaxed text-foreground/90">{verdict}</p>}

                    {weakAreas.length > 0 && (
                      <div className="mt-3">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t("Weak areas")}:
                        </span>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {weakAreas.map((area, idx) => (
                            <span
                              key={idx}
                              className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] text-foreground"
                            >
                              {area}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {tomorrowImprovements.length > 0 && (
                      <div className="mt-3">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t("Fix tomorrow")}:
                        </span>
                        <div className="mt-1 space-y-1">
                          {tomorrowImprovements.map((imp, idx) => (
                            <p key={idx} className="text-xs text-foreground/80">
                              • {imp}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
