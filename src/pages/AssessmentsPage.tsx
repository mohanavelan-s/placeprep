import { useEffect, useMemo, useState } from "react";
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
  type AssessmentQuestion,
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

function QuestionCard({
  question,
  value,
  onChange,
  disabled,
}: {
  question: AssessmentQuestion;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
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

      {question.referenceUrl && (
        <a
          href={question.referenceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-2 text-sm text-primary transition hover:text-foreground"
        >
          {question.referenceLabel || question.taskTitle || "Open linked task"}
          <ArrowUpRight className="h-4 w-4" />
        </a>
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
  const [durationMinutes, setDurationMinutes] = useState("20");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [missingPlanDialogOpen, setMissingPlanDialogOpen] = useState(false);

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

  const startAssessmentMutation = useMutation({
    mutationFn: () =>
      generateAssessment({
        assessmentType: selectedType,
        durationMinutes: Math.min(90, Math.max(10, Number(durationMinutes || 20))),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["assessments", "overview"] });
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
    mutationFn: () => {
      if (!currentSession) {
        throw new Error("Start an assessment before submitting.");
      }

      return submitAssessment(currentSession.id, { answers });
    },
    onSuccess: async (session) => {
      await queryClient.invalidateQueries({ queryKey: ["assessments", "overview"] });
      setAnswers(Object.fromEntries(Object.entries(session.submission?.answers || {}).map(([key, value]) => [key, String(value || "")])));
      toast.success("Assessment submitted. Weak spots and recommendations are ready.");
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
              Choose the assessment format you want: MCQs, fill in the blanks, or short programming under an average time budget. The questions pull from your active Prep Architect plan, recent tasks, and role focus.
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
            Assessments stay role-aware. A Data Analyst plan leans into SQL, analysis, dashboards, and metrics. A Data Engineer plan leans into pipelines, warehousing, orchestration, and implementation. Software roles keep leaning into DSA, core CS, and systems.
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
                    Started {formatDateTime(currentSession.startedAt)} / {currentSession.durationMinutes} total minutes
                  </p>
                </div>

                <div className="rounded-full border border-border/80 bg-background/70 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {unansweredCount} unanswered
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {currentSession.questions.map((question) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    value={answers[question.id] || ""}
                    onChange={(next) => setAnswers((current) => ({ ...current, [question.id]: next }))}
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

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.15rem] border border-border/80 bg-background/45 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Weak spots</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(currentSession.weakSpots.length ? currentSession.weakSpots : ["No critical weak spots"]).map((topic) => (
                      <span key={topic} className="rounded-full border border-border/80 bg-card/60 px-3 py-1.5 text-sm text-foreground/85">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.15rem] border border-border/80 bg-background/45 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Plan adjustment</p>
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    If the weak spots are real, push them back into Prep Architect so the roadmap, tasks, and flashcards adapt.
                  </p>
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
                Start with the assessment type that fits your energy and preference today. MCQs are the quickest, fill-in-the-blanks force retrieval, and short programming mirrors actual execution under time pressure.
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
