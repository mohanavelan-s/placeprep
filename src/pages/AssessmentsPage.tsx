import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Brain,
  CheckCircle2,
  ClipboardList,
  Code2,
  FileQuestion,
  Loader2,
  PenLine,
  RefreshCcw,
  Sparkles,
  TimerReset,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import SoftSyncNotice from "@/components/SoftSyncNotice";
import { AssessmentsSkeleton } from "@/components/WorkspaceSkeletons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useQueryErrorLogger } from "@/hooks/use-query-error-logger";
import {
  applyAssessmentPlanUpdate,
  fetchAssessmentOverview,
  generateAssessment,
  submitAssessment,
  type AssessmentPhase,
  type AssessmentQuestion,
  type AssessmentScope,
  type AssessmentSession,
  type AssessmentType,
} from "@/lib/api";

const ASSESSMENT_OPTIONS: Array<{
  type: AssessmentType;
  title: string;
  description: string;
  icon: typeof ClipboardList;
}> = [
  {
    type: "mcq",
    title: "MCQ sprint",
    description: "Fast concept checks for the plan topics you're actively pushing.",
    icon: FileQuestion,
  },
  {
    type: "fill_blank",
    title: "Fill in the blanks",
    description: "Short retrieval prompts to test whether the idea is actually in memory.",
    icon: PenLine,
  },
  {
    type: "coding",
    title: "Short programming",
    description: "Timed implementation or pseudocode under an interview-style average time budget.",
    icon: Code2,
  },
];

const ASSESSMENT_SCOPES: Array<{
  value: AssessmentScope;
  title: string;
  description: string;
}> = [
  {
    value: "daily",
    title: "Daily focus",
    description: "Pull questions from today’s assigned tasks, your known topics, and the current plan lane.",
  },
  {
    value: "weekly",
    title: "Weekly sweep",
    description: "Widen the spread across this week’s roadmap themes, active task lane, and your known base.",
  },
];

const ASSESSMENT_PHASE_OPTIONS: Array<{
  value: AssessmentPhase;
  title: string;
  description: string;
}> = [
  {
    value: "pre",
    title: "Pre baseline",
    description: "Measure where the user stands before the next deliberate round of work.",
  },
  {
    value: "post",
    title: "Post check",
    description: "Measure whether the recent work actually tightened recall and answer quality.",
  },
  {
    value: "surprise",
    title: "Surprise test",
    description: "Pressure-test consistency with less obvious signaling and less dependence on source links.",
  },
];

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not started";
  }

  try {
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function scoreTone(score: number) {
  if (score >= 80) {
    return "text-emerald-200 border-emerald-400/20 bg-emerald-500/10";
  }

  if (score >= 60) {
    return "text-amber-200 border-amber-400/20 bg-amber-500/10";
  }

  return "text-rose-200 border-rose-400/20 bg-rose-500/10";
}

function formatAssessmentPhase(value?: AssessmentPhase | string | null) {
  if (value === "post") {
    return "Post check";
  }

  if (value === "surprise") {
    return "Surprise test";
  }

  return "Pre baseline";
}

function formatCountdown(totalSeconds: number | null) {
  if (totalSeconds === null || totalSeconds < 0) {
    return "--:--";
  }

  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function scoreDeltaTone(delta: number) {
  if (delta > 0) {
    return "text-emerald-200";
  }

  if (delta < 0) {
    return "text-rose-200";
  }

  return "text-muted-foreground";
}

function QuestionCard({
  question,
  value,
  onChange,
  disabled,
  onBlockedPaste,
}: {
  question: AssessmentQuestion;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  onBlockedPaste: () => void;
}) {
  const sourceLabel = question.referenceLabel || question.taskTitle || question.topic;

  return (
    <article className="rounded-[1.25rem] border border-border/80 bg-card/60 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{question.topic}</p>
          <h4 className="mt-2 text-lg text-foreground">{question.prompt}</h4>
        </div>

        <div className="rounded-full border border-border/80 bg-background/70 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Avg {question.averageTimeMinutes} min
        </div>
      </div>

      <div className="mt-4 rounded-[1rem] border border-border/80 bg-background/45 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border/70 bg-card/70 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {question.contextTitle || "Assessment brief"}
          </span>
          {sourceLabel && (
            <span className="rounded-full border border-border/70 bg-card/70 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Source anchor: {sourceLabel}
            </span>
          )}
        </div>

        {question.contextSummary && (
          <p className="mt-3 text-sm leading-6 text-foreground/85">{question.contextSummary}</p>
        )}

        {(question.expectedTimeComplexity || question.expectedSpaceComplexity) && (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {question.expectedTimeComplexity && (
              <div className="rounded-[0.9rem] border border-border/70 bg-card/60 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Expected time</p>
                <p className="mt-1 text-sm text-foreground/85">{question.expectedTimeComplexity}</p>
              </div>
            )}
            {question.expectedSpaceComplexity && (
              <div className="rounded-[0.9rem] border border-border/70 bg-card/60 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Expected space</p>
                <p className="mt-1 text-sm text-foreground/85">{question.expectedSpaceComplexity}</p>
              </div>
            )}
          </div>
        )}

        {!!question.benchmarkChecks?.length && (
          <div className="mt-3 flex flex-wrap gap-2">
            {question.benchmarkChecks.map((item) => (
              <span key={item} className="rounded-full border border-border/70 bg-card/60 px-3 py-1.5 text-xs text-foreground/80">
                {item}
              </span>
            ))}
          </div>
        )}
      </div>

      {question.referenceUrl && (
        <p className="mt-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Linked source captured in-module for the test. Stay here and answer from recall.
        </p>
      )}

      {question.type === "mcq" && (
        <RadioGroup
          className="mt-5 grid gap-3"
          value={value}
          onValueChange={onChange}
          disabled={disabled}
        >
          {(question.choices || []).map((choice) => (
            <label
              key={choice.id}
              className="flex cursor-pointer items-start gap-3 rounded-[1rem] border border-border/80 bg-background/45 px-4 py-3 transition hover:border-primary/30"
            >
              <RadioGroupItem value={choice.id} id={choice.id} className="mt-1" />
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{choice.label}</p>
                <p className="mt-1 text-sm leading-6 text-foreground/85">{choice.text}</p>
              </div>
            </label>
          ))}
        </RadioGroup>
      )}

      {question.type === "fill_blank" && (
        <div className="mt-5">
          <Input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onPaste={(event) => {
              event.preventDefault();
              onBlockedPaste();
            }}
            onDrop={(event) => {
              event.preventDefault();
              onBlockedPaste();
            }}
            placeholder={question.placeholder || "Type the missing phrase"}
            className="h-11 border-border/80 bg-background/70"
            disabled={disabled}
          />
        </div>
      )}

      {question.type === "coding" && (
        <div className="mt-5">
          <Textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onPaste={(event) => {
              event.preventDefault();
              onBlockedPaste();
            }}
            onDrop={(event) => {
              event.preventDefault();
              onBlockedPaste();
            }}
            placeholder={question.placeholder || "Write code or structured pseudocode here."}
            className="min-h-[170px] border-border/80 bg-background/70"
            disabled={disabled}
          />
        </div>
      )}
    </article>
  );
}

export default function AssessmentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<AssessmentType>("mcq");
  const [assessmentScope, setAssessmentScope] = useState<AssessmentScope>("daily");
  const [assessmentPhase, setAssessmentPhase] = useState<AssessmentPhase>("pre");
  const [durationMinutes, setDurationMinutes] = useState("20");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [missingPlanDialogOpen, setMissingPlanDialogOpen] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [autoSubmittedSessionId, setAutoSubmittedSessionId] = useState<string | null>(null);
  const lastPasteWarningAtRef = useRef(0);

  const overviewQuery = useQuery({
    queryKey: ["assessments", "overview"],
    queryFn: fetchAssessmentOverview,
  });

  useQueryErrorLogger("AssessmentsPage:overview", overviewQuery.error);

  const currentSession = overviewQuery.data?.currentSession || null;
  const recentSessions = overviewQuery.data?.recentSessions || [];
  const activePlan = overviewQuery.data?.activePlan || null;
  const isBooting = overviewQuery.isPending && !overviewQuery.data;

  useEffect(() => {
    if (overviewQuery.isPending) {
      return;
    }

    setMissingPlanDialogOpen(!activePlan);
  }, [activePlan, overviewQuery.isPending]);

  useEffect(() => {
    if (!currentSession) {
      setAnswers({});
      return;
    }

    const seededAnswers = Object.fromEntries(
      Object.entries(currentSession.submission?.answers || {}).map(([key, value]) => [key, String(value || "")]),
    );
    setAnswers(seededAnswers);
  }, [currentSession]);

  useEffect(() => {
    if (!currentSession || currentSession.status === "completed") {
      setRemainingSeconds(null);
      return;
    }

    const expiresAt = currentSession.expiresAt
      ? new Date(currentSession.expiresAt).getTime()
      : currentSession.startedAt
        ? new Date(currentSession.startedAt).getTime() + (currentSession.durationMinutes * 60000)
        : null;

    if (!expiresAt || Number.isNaN(expiresAt)) {
      setRemainingSeconds(null);
      return;
    }

    const updateRemaining = () => {
      setRemainingSeconds(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    };

    updateRemaining();
    const intervalId = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(intervalId);
  }, [currentSession]);

  function handleBlockedPaste() {
    const now = Date.now();

    if (now - lastPasteWarningAtRef.current > 2500) {
      lastPasteWarningAtRef.current = now;
      toast.error("Paste is disabled during assessments. Answer from recall.");
    }
  }

  const startAssessmentMutation = useMutation({
    mutationFn: () =>
      generateAssessment({
        assessmentType: selectedType,
        assessmentScope,
        assessmentPhase,
        durationMinutes: Math.min(90, Math.max(10, Number(durationMinutes || 20))),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["assessments", "overview"] });
      setAutoSubmittedSessionId(null);
      toast.success("Assessment generated from your current plan.");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Unable to generate assessment.";
      toast.error(message);

      if (/create a prep architect plan first/i.test(message)) {
        setMissingPlanDialogOpen(true);
      }
    },
  });

  const submitAssessmentMutation = useMutation({
    mutationFn: (options?: { timedOut?: boolean }) => {
      if (!currentSession) {
        throw new Error("Start an assessment before submitting.");
      }

      return submitAssessment(currentSession.id, {
        answers,
        timedOut: options?.timedOut === true,
      });
    },
    onSuccess: async (session, options) => {
      await queryClient.invalidateQueries({ queryKey: ["assessments", "overview"] });
      setAnswers(Object.fromEntries(Object.entries(session.submission?.answers || {}).map(([key, value]) => [key, String(value || "")])));
      if (options?.timedOut) {
        toast.info("Time ran out. The assessment was auto-submitted and the report is ready.");
      } else {
        toast.success("Assessment submitted. Weak spots and recommendations are ready.");
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to submit assessment.");
    },
  });

  const applyPlanUpdateMutation = useMutation({
    mutationFn: () => {
      if (!currentSession) {
        throw new Error("No completed assessment is available.");
      }

      return applyAssessmentPlanUpdate(currentSession.id);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["assessments", "overview"] }),
        queryClient.invalidateQueries({ queryKey: ["prep-plan", "latest"] }),
        queryClient.invalidateQueries({ queryKey: ["prep-plan", "history"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks", "today"] }),
        queryClient.invalidateQueries({ queryKey: ["progress-summary"] }),
      ]);
      toast.success("Prep Architect plan updated from the assessment weak spots.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to apply the assessment changes to the plan.");
    },
  });

  const unansweredCount = useMemo(() => {
    if (!currentSession || currentSession.status === "completed") {
      return 0;
    }

    return currentSession.questions.filter((question) => !String(answers[question.id] || "").trim()).length;
  }, [answers, currentSession]);

  useEffect(() => {
    if (!currentSession || currentSession.status === "completed") {
      return;
    }

    if (remainingSeconds === null || remainingSeconds > 0) {
      return;
    }

    if (submitAssessmentMutation.isPending || autoSubmittedSessionId === currentSession.id) {
      return;
    }

    setAutoSubmittedSessionId(currentSession.id);
    submitAssessmentMutation.mutate({ timedOut: true });
  }, [autoSubmittedSessionId, currentSession, remainingSeconds, submitAssessmentMutation]);

  const activePhaseLabel = formatAssessmentPhase(currentSession?.assessmentPhase || assessmentPhase);
  const report = currentSession?.report || null;
  const strongAnswerCount = currentSession?.submission?.questionResults?.filter((result) => Number(result.score || 0) >= 0.75).length || 0;
  const timedOut = currentSession?.submission?.timedOut === true;

  if (isBooting) {
    return <AssessmentsSkeleton />;
  }

  return (
    <div className="grid gap-6">
      <section className="surface-panel-strong p-6 md:p-7">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="section-label">Assessments</p>
            <h2 className="mt-2 font-heading text-4xl text-foreground md:text-5xl">
              Test recall in the same lane your plan is asking you to improve.
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-foreground/80">
              Choose the assessment format and phase you want: a pre-baseline, a post-check, or a surprise test. The prompts stay inside this module, the clock stays visible, and the report pushes the next plan update toward consistency instead of guesswork.
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-background/40 px-4 py-3 text-sm text-foreground/80">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Active plan source</p>
            <p className="mt-2 font-heading text-2xl text-foreground">
              {activePlan?.title || "Prep plan needed"}
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {activePlan
                ? `v${activePlan.version} / ${activePlan.durationMonths} month${activePlan.durationMonths === 1 ? "" : "s"}`
                : "No assessment can start yet"}
            </p>
          </div>
        </div>
      </section>

      {overviewQuery.isError && (
        <SoftSyncNotice
          title="Assessment data is temporarily unavailable."
          description="Retry to restore your latest session, recent results, and adaptive recommendations."
          actionLabel="Retry"
          onAction={() => void overviewQuery.refetch()}
        />
      )}

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="surface-panel p-6 md:p-7">
          <div className="flex items-center gap-2 text-foreground">
            <Brain className="h-4 w-4 text-primary" />
            <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Assessment builder</p>
          </div>

          <div className="mt-5 grid gap-3">
            {ASSESSMENT_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isActive = selectedType === option.type;

              return (
                <button
                  key={option.type}
                  type="button"
                  onClick={() => setSelectedType(option.type)}
                  className={`rounded-[1.15rem] border px-4 py-4 text-left transition ${
                    isActive
                      ? "border-primary/35 bg-primary/10 shadow-[0_0_24px_hsl(0_55%_33%_/_0.08)]"
                      : "border-border/80 bg-background/45 hover:border-border hover:bg-background/60"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-full border border-border/80 bg-background/60 p-2">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-base text-foreground">{option.title}</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{option.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-6 rounded-[1.15rem] border border-border/80 bg-background/45 p-4">
            <Label htmlFor="assessment-duration" className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Assessment duration
            </Label>
            <Input
              id="assessment-duration"
              type="number"
              min={10}
              max={90}
              step={5}
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(event.target.value)}
              className="mt-3 h-11 border-border/80 bg-background/70"
            />
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              The average time per question adapts to this window. Coding assessments automatically reserve more time per prompt.
            </p>
          </div>

          <div className="mt-6 rounded-[1.15rem] border border-border/80 bg-background/45 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Assessment scope</p>
            <div className="mt-4 grid gap-3">
              {ASSESSMENT_SCOPES.map((scope) => (
                <button
                  key={scope.value}
                  type="button"
                  onClick={() => setAssessmentScope(scope.value)}
                  className={`rounded-[1rem] border px-4 py-4 text-left transition ${
                    assessmentScope === scope.value
                      ? "border-primary/35 bg-primary/10"
                      : "border-border/80 bg-card/50 hover:border-border hover:bg-background/60"
                  }`}
                >
                  <p className="text-sm text-foreground">{scope.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{scope.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-[1.15rem] border border-border/80 bg-background/45 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Measurement phase</p>
            <div className="mt-4 grid gap-3">
              {ASSESSMENT_PHASE_OPTIONS.map((phase) => (
                <button
                  key={phase.value}
                  type="button"
                  onClick={() => setAssessmentPhase(phase.value)}
                  className={`rounded-[1rem] border px-4 py-4 text-left transition ${
                    assessmentPhase === phase.value
                      ? "border-primary/35 bg-primary/10"
                      : "border-border/80 bg-card/50 hover:border-border hover:bg-background/60"
                  }`}
                >
                  <p className="text-sm text-foreground">{phase.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{phase.description}</p>
                </button>
              ))}
            </div>
          </div>

          <Button
            type="button"
            className="mt-6 h-11 gap-2"
            onClick={() => startAssessmentMutation.mutate()}
            disabled={startAssessmentMutation.isPending || !activePlan}
          >
            {startAssessmentMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {startAssessmentMutation.isPending ? "Building assessment..." : "Start assessment"}
          </Button>

          <div className="mt-6 rounded-[1.15rem] border border-border/80 bg-card/60 p-4 text-sm leading-6 text-muted-foreground">
            Assessments stay role-aware and consistency-aware. A Data Analyst plan leans into SQL, analysis, dashboards, and metrics. A Data Engineer plan leans into pipelines, warehousing, orchestration, and implementation. Software roles keep leaning into DSA, core CS, and systems.
          </div>
        </section>

        <section className="surface-panel p-6 md:p-7">
          {currentSession && currentSession.status !== "completed" ? (
            <>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Current assessment</p>
                  <h3 className="mt-2 font-heading text-3xl text-foreground">
                    {currentSession.assessmentType === "mcq"
                      ? "MCQ sprint"
                      : currentSession.assessmentType === "fill_blank"
                        ? "Fill in the blanks"
                        : "Short programming"}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Started {formatDateTime(currentSession.startedAt)} / {currentSession.durationMinutes} total minutes / {currentSession.assessmentScope || "daily"} scope / {activePhaseLabel}
                  </p>
                </div>

                <div className="grid gap-2 sm:min-w-[210px]">
                  <div className={`rounded-[1rem] border px-4 py-3 ${remainingSeconds !== null && remainingSeconds <= 300 ? "border-rose-400/30 bg-rose-500/10" : "border-border/80 bg-background/70"}`}>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Countdown</p>
                    <p className="mt-2 font-heading text-3xl text-foreground">{formatCountdown(remainingSeconds)}</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">Auto-submit triggers at zero.</p>
                  </div>
                  <div className="rounded-full border border-border/80 bg-background/70 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {unansweredCount} unanswered
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-[1rem] border border-border/80 bg-background/45 px-4 py-3 text-sm leading-6 text-muted-foreground">
                Paste is blocked during the assessment. Answer from recall, explain the approach directly here, and let the timer show the real signal.
              </div>

              <div className="mt-6 space-y-4">
                {currentSession.questions.map((question) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    value={answers[question.id] || ""}
                    onChange={(next) => setAnswers((current) => ({ ...current, [question.id]: next }))}
                    disabled={submitAssessmentMutation.isPending || remainingSeconds === 0}
                    onBlockedPaste={handleBlockedPaste}
                  />
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button
                  type="button"
                  className="h-11 gap-2"
                  onClick={() => submitAssessmentMutation.mutate()}
                  disabled={submitAssessmentMutation.isPending}
                >
                  {submitAssessmentMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {submitAssessmentMutation.isPending ? "Submitting..." : "Submit assessment"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="h-11 gap-2 border-border/80 bg-background/70"
                  onClick={() => startAssessmentMutation.mutate()}
                  disabled={startAssessmentMutation.isPending}
                >
                  <RefreshCcw className="h-4 w-4" />
                  Regenerate
                </Button>
              </div>
            </>
          ) : currentSession ? (
            <>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Latest result</p>
                  <h3 className="mt-2 font-heading text-3xl text-foreground">Assessment complete</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Submitted {formatDateTime(currentSession.submittedAt)}
                  </p>
                </div>

                <div className={`rounded-full border px-4 py-2 text-sm uppercase tracking-[0.16em] ${scoreTone(currentSession.score)}`}>
                  {Math.round(currentSession.score)}% score
                </div>
              </div>

              {timedOut && (
                <div className="mt-5 rounded-[1rem] border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
                  The timer expired before submission. This report is still valid, but it should be read as a live-pressure signal.
                </div>
              )}

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[1.15rem] border border-border/80 bg-background/45 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Coverage</p>
                  <p className="mt-2 font-heading text-3xl text-foreground">{currentSession.questions.length}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{formatAssessmentPhase(currentSession.assessmentPhase)} / {currentSession.assessmentScope || "daily"} scope</p>
                </div>

                <div className="rounded-[1.15rem] border border-border/80 bg-background/45 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Strong answers</p>
                  <p className="mt-2 font-heading text-3xl text-foreground">{strongAnswerCount}</p>
                  <p className="mt-2 text-sm text-muted-foreground">Questions that landed above the useful-quality bar.</p>
                </div>

                <div className="rounded-[1.15rem] border border-border/80 bg-background/45 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Industry benchmark</p>
                  <p className="mt-2 font-heading text-3xl text-foreground">{Math.round(report?.benchmarkScore || 0)}%</p>
                  <p className="mt-2 text-sm text-muted-foreground">{report?.benchmarkComparison || "Benchmark comparison not available yet."}</p>
                </div>

                <div className="rounded-[1.15rem] border border-border/80 bg-background/45 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Phase trend</p>
                  <p className="mt-2 font-heading text-3xl text-foreground">{Math.round(report?.phaseAverageScore || currentSession.score)}%</p>
                  <p className={`mt-2 text-sm ${scoreDeltaTone(Number(report?.phaseDeltaScore || 0))}`}>
                    {Number(report?.phaseDeltaScore || 0) > 0 ? "+" : ""}{Number(report?.phaseDeltaScore || 0).toFixed(1)} vs your average in this phase
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.15rem] border border-border/80 bg-background/45 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Strong spots</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {((report?.strongSpots?.length ? report.strongSpots : currentSession.submission?.questionResults?.filter((result) => Number(result.score || 0) >= 0.75).map((result) => result.topic)) || ["No strong spots recorded"]).map((topic) => (
                      <span key={topic} className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-100">
                        {topic}
                      </span>
                    ))}
                  </div>
                  {!!report?.strongSignals?.length && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {report.strongSignals.map((signal) => (
                        <span key={signal} className="rounded-full border border-border/80 bg-card/60 px-3 py-1.5 text-xs text-foreground/80">
                          {signal}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-[1.15rem] border border-border/80 bg-background/45 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Weak spots</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(currentSession.weakSpots.length ? currentSession.weakSpots : ["No critical weak spots"]).map((topic) => (
                      <span key={topic} className="rounded-full border border-border/80 bg-card/60 px-3 py-1.5 text-sm text-foreground/85">
                        {topic}
                      </span>
                    ))}
                  </div>
                  {!!report?.gapSignals?.length && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {report.gapSignals.map((signal) => (
                        <span key={signal} className="rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-100">
                          {signal}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-[1.05fr_0.95fr]">
                <div className="rounded-[1.15rem] border border-border/80 bg-background/45 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Plan adjustment</p>
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    {report?.summary || "If the weak spots are real, push them back into Prep Architect so the roadmap, tasks, and flashcards adapt."}
                  </p>

                  {!!report?.fixPlan?.length && (
                    <div className="mt-4 space-y-2">
                      {report.fixPlan.map((item) => (
                        <div key={item} className="rounded-[0.95rem] border border-border/70 bg-card/60 px-3 py-3 text-sm text-foreground/85">
                          {item}
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    type="button"
                    className="mt-4 h-10 gap-2"
                    onClick={() => applyPlanUpdateMutation.mutate()}
                    disabled={applyPlanUpdateMutation.isPending || !currentSession.weakSpots.length}
                  >
                    {applyPlanUpdateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <TimerReset className="h-4 w-4" />
                    )}
                    {applyPlanUpdateMutation.isPending ? "Updating plan..." : "Apply to plan"}
                  </Button>
                </div>

                <div className="rounded-[1.15rem] border border-border/80 bg-background/45 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Consistency note</p>
                  <p className="mt-4 text-base leading-7 text-foreground/85">
                    {report?.motivation || "Consistency is key. Keep the next block honest and let the weak spots drive the plan."}
                  </p>
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    {report?.consistencyLine || "Follow the goal, follow the plan, and let repetition close the gap."}
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {(currentSession.recommendations || []).map((recommendation) => (
                  <article
                    key={`${recommendation.topic}-${recommendation.problemLabel || recommendation.resourceLabel || "rec"}`}
                    className="rounded-[1.15rem] border border-border/80 bg-card/60 p-4"
                  >
                    <p className="text-sm uppercase tracking-[0.16em] text-muted-foreground">{recommendation.topic}</p>
                    <p className="mt-2 text-base text-foreground">{recommendation.action}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{recommendation.reason}</p>

                    <div className="mt-4 flex flex-wrap gap-3">
                      {recommendation.problemUrl && (
                        <a
                          href={recommendation.problemUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-primary transition hover:text-foreground"
                        >
                          {recommendation.problemLabel || "Open linked problem"}
                          <ArrowUpRight className="h-4 w-4" />
                        </a>
                      )}
                      {recommendation.resourceUrl && (
                        <a
                          href={recommendation.resourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-primary transition hover:text-foreground"
                        >
                          {recommendation.resourceLabel || "Open review resource"}
                          <ArrowUpRight className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </div>

              {!!currentSession.submission?.questionResults?.length && (
                <div className="mt-6 rounded-[1.15rem] border border-border/80 bg-background/45 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Question review</p>
                  <div className="mt-4 space-y-3">
                    {currentSession.submission.questionResults.map((result) => (
                      <div
                        key={result.questionId}
                        className="rounded-[1rem] border border-border/70 bg-card/60 px-4 py-3"
                      >
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-sm text-foreground">{result.topic}</p>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">{result.feedback}</p>
                          </div>
                          <span className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.16em] ${scoreTone(result.score * 100)}`}>
                            {Math.round(result.score * 100)}%
                          </span>
                        </div>

                        {result.industryComparison && (
                          <p className="mt-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                            {result.industryComparison}
                          </p>
                        )}

                        {(result.timeComplexity || result.spaceComplexity) && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {result.timeComplexity && (
                              <span className="rounded-full border border-border/80 bg-background/70 px-3 py-1.5 text-xs text-foreground/80">
                                Time: {result.timeComplexity}
                              </span>
                            )}
                            {result.spaceComplexity && (
                              <span className="rounded-full border border-border/80 bg-background/70 px-3 py-1.5 text-xs text-foreground/80">
                                Space: {result.spaceComplexity}
                              </span>
                            )}
                          </div>
                        )}

                        {!!result.strengths?.length && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {result.strengths.map((item) => (
                              <span key={item} className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100">
                                {item}
                              </span>
                            ))}
                          </div>
                        )}

                        {!!result.weaknesses?.length && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {result.weaknesses.map((item) => (
                              <span key={item} className="rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-100">
                                {item}
                              </span>
                            ))}
                          </div>
                        )}

                        {result.recommendation && (
                          <p className="mt-3 text-sm leading-6 text-muted-foreground">{result.recommendation}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 gap-2 border-border/80 bg-background/70"
                  onClick={() => startAssessmentMutation.mutate()}
                  disabled={startAssessmentMutation.isPending || !activePlan}
                >
                  <RefreshCcw className="h-4 w-4" />
                  Take another assessment
                </Button>
              </div>
            </>
          ) : (
            <div className="rounded-[1.25rem] border border-border/80 bg-background/45 p-6">
              <div className="flex items-center gap-3 text-foreground">
                <ClipboardList className="h-5 w-5 text-primary" />
                <p className="text-lg">No assessment started yet.</p>
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Start with the assessment type that fits your energy and preference today. Daily scope leans on today’s assigned work, while weekly scope gives you a broader sweep across the current roadmap.
              </p>
            </div>
          )}
        </section>
      </div>

      <section className="surface-panel p-6 md:p-7">
        <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Recent assessments</p>
        <div className="mt-5 grid gap-3 xl:grid-cols-3">
          {recentSessions.length ? recentSessions.map((session: AssessmentSession) => (
            <article
              key={session.id}
              className="rounded-[1.15rem] border border-border/80 bg-card/60 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.16em] text-muted-foreground">
                    {session.assessmentType.replace("_", " ")}
                  </p>
                  <p className="mt-2 text-base text-foreground">{formatDateTime(session.createdAt)}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {session.assessmentScope || "daily"} scope / {formatAssessmentPhase(session.assessmentPhase)}
                  </p>
                </div>
                <div className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.16em] ${scoreTone(session.score)}`}>
                  {session.status === "completed" ? `${Math.round(session.score)}%` : session.status}
                </div>
              </div>

              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {session.weakSpots?.length
                  ? `Weak spots: ${session.weakSpots.join(", ")}`
                  : "No weak spots recorded yet for this session."}
              </p>

              {session.report?.benchmarkComparison && (
                <p className="mt-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {session.report.benchmarkComparison}
                </p>
              )}
            </article>
          )) : (
            <div className="xl:col-span-3 rounded-[1.15rem] border border-border/80 bg-card/60 px-4 py-4 text-sm text-muted-foreground">
              Once you submit assessments, the latest attempts will appear here with weak spots and the score trend.
            </div>
          )}
        </div>
      </section>

      <Dialog open={missingPlanDialogOpen} onOpenChange={setMissingPlanDialogOpen}>
        <DialogContent className="border-border/80 bg-card text-foreground sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create a Prep Architect plan first</DialogTitle>
            <DialogDescription>
              Assessments are built from the role and topics in your active plan. Create one first so the questions, timing, and recommendations stay relevant.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => setMissingPlanDialogOpen(false)}>
              Later
            </Button>
            <Button
              type="button"
              onClick={() => {
                setMissingPlanDialogOpen(false);
                navigate("/prep-architect");
              }}
            >
              Open Prep Architect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
