import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  ArrowDown,
  ArrowUp,
  Brain,
  Check,
  CheckCircle2,
  ClipboardList,
  Code2,
  FileQuestion,
  GripVertical,
  Lightbulb,
  Loader2,
  PenLine,
  RefreshCcw,
  Sparkles,
  TimerReset,
  Trash2,
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
import { useQueryErrorLogger } from "@/hooks/use-query-error-logger";
import {
  applyAssessmentPlanUpdate,
  clearAssessmentHistory,
  deleteAssessmentSession,
  fetchAssessmentOverview,
  generateAssessment,
  submitAssessment,
  type AssessmentGeneratorType,
  type AssessmentQuestion,
  type AssessmentScope,
  type AssessmentSession,
} from "@/lib/api";

const ASSESSMENT_OPTIONS: Array<{
  type: AssessmentGeneratorType;
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
  {
    type: "ordering",
    title: "Ordering drill",
    description: "Arrange reasoning steps in the order you would explain them live.",
    icon: ClipboardList,
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

function difficultyLabel(value?: string) {
  if (value === "hard_plus") {
    return "Hard+";
  }

  return value ? value.replace("_", " ") : "Medium";
}

function parseOrderingValue(question: AssessmentQuestion, value: string) {
  const fallback = question.items?.map((item) => item.id) || [];

  if (!value) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      const parsedIds = parsed.map(String).filter((id) => fallback.includes(id));
      const missingIds = fallback.filter((id) => !parsedIds.includes(id));
      return [...parsedIds, ...missingIds];
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function moveItem(values: string[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= values.length) {
    return values;
  }

  const next = [...values];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

function buildApproachHint(question: AssessmentQuestion) {
  if (question.approachHint) {
    return question.approachHint;
  }

  const reference = question.referenceLabel || question.taskTitle || question.topic || "this problem";
  const prompt = `${reference} ${question.prompt}`.toLowerCase();

  if (/two sum|pair sum/.test(prompt)) {
    return `For ${reference}, track the complement needed for each value and explain why one pass avoids repeated scanning.`;
  }

  if (/binary search|sorted|lower bound|upper bound/.test(prompt)) {
    return `For ${reference}, define the sorted invariant first, then update left/right only after checking what half is impossible.`;
  }

  if (/sliding window|subarray|substring|window/.test(prompt)) {
    return `For ${reference}, state what makes a window valid, then move the left pointer only when that rule breaks.`;
  }

  if (/stack|parentheses|bracket|monotonic/.test(prompt)) {
    return `For ${reference}, name what the stack represents after each step; the top should explain the next decision.`;
  }

  if (/linked list|node|pointer/.test(prompt)) {
    return `For ${reference}, draw the pointer change before coding and protect the empty, one-node, and tail cases.`;
  }

  if (/tree|bst|binary tree/.test(prompt)) {
    return `For ${reference}, decide whether the answer is local to a node or must be carried through recursion/level order.`;
  }

  if (/graph|bfs|dfs/.test(prompt)) {
    return `For ${reference}, name the graph state, the visited rule, and the exact moment a node becomes safe to skip.`;
  }

  if (/dynamic|dp|memo/.test(prompt)) {
    return `For ${reference}, say the subproblem in one sentence before writing the transition and base cases.`;
  }

  if (/sql|database|dbms/.test(prompt)) {
    return `For ${reference}, identify the rows that must survive filtering, the join relationship, and the cheapest grouping path.`;
  }

  if (/system|design|scale|cache/.test(prompt)) {
    return `For ${reference}, separate requirements from mechanisms, then justify the cache, queue, or database by the bottleneck.`;
  }

  return `For ${reference}, restate input/output, choose the pattern that removes repeated work, then test the smallest edge case before committing.`;
}

function extractLeetCodeNumberFromQuestion(question: AssessmentQuestion) {
  const source = [
    question.referenceLabel,
    question.referenceUrl,
    question.taskTitle,
    question.topic,
    question.prompt,
  ].join(" ");

  return source.match(/\b(?:leetcode|lc)\s*:?\s*#?\s*(\d{1,5})\b/i)?.[1]
    || source.match(/\bleetcode\.com\/problems\/[^/\s]+\/?[^0-9]*(\d{1,5})?\b/i)?.[1]
    || source.match(/^\s*(\d{1,5})\.\s+/)?.[1]
    || "";
}

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function countAnswerChanges(answerStats?: Record<string, unknown>) {
  return Object.values(answerStats || {}).reduce((total, stat) => {
    if (!stat || typeof stat !== "object") {
      return total;
    }

    return total + Number((stat as { answerChanges?: number }).answerChanges || 0);
  }, 0);
}

function QuestionCard({
  question,
  value,
  onChange,
  disabled,
  onHint,
  hint,
  onOpenCodingLab,
}: {
  question: AssessmentQuestion;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  onHint?: () => void;
  hint?: string;
  onOpenCodingLab?: () => void;
}) {
  const orderingIds = question.type === "ordering" ? parseOrderingValue(question, value) : [];
  const orderingItemsById = new Map((question.items || []).map((item) => [item.id, item]));

  return (
    <article className="rounded-[1.25rem] border border-border/80 bg-card/60 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{question.topic}</p>
          <h4 className="mt-2 text-lg text-foreground">{question.prompt}</h4>
        </div>

        <div className="rounded-full border border-border/80 bg-background/70 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-muted-foreground">
          {difficultyLabel(question.difficulty)} / Avg {question.averageTimeMinutes} min
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
        <div className="mt-5 rounded-[1rem] border border-border/80 bg-background/45 p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm leading-6 text-muted-foreground">
                Solve this in the Coding Lab so the code runs in the sandbox, shows test cases, and records time-aware feedback.
              </p>
              {value && (
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">{value}</p>
              )}
            </div>
            <Button
              type="button"
              className="h-10 shrink-0 gap-2"
              disabled={disabled}
              onClick={onOpenCodingLab}
            >
              <Code2 className="h-4 w-4" />
              Open timed Coding Lab
            </Button>
          </div>
        </div>
      )}

      {question.type === "ordering" && (
        <div className="mt-5 grid gap-3">
          {orderingIds.map((itemId, index) => {
            const item = orderingItemsById.get(itemId);
            if (!item) {
              return null;
            }

            return (
              <div
                key={itemId}
                className="flex items-center gap-3 rounded-[1rem] border border-border/80 bg-background/45 px-4 py-3"
              >
                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Step {index + 1}</p>
                  <p className="mt-1 text-sm leading-6 text-foreground/85">{item.text}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    disabled={disabled || index === 0}
                    onClick={() => onChange(JSON.stringify(moveItem(orderingIds, index, -1)))}
                    aria-label="Move step up"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    disabled={disabled || index === orderingIds.length - 1}
                    onClick={() => onChange(JSON.stringify(moveItem(orderingIds, index, 1)))}
                    aria-label="Move step down"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {onHint && (
        <div className="mt-5 rounded-[1rem] border border-border/80 bg-background/45 px-4 py-3">
          <Button
            type="button"
            variant="outline"
            className="h-9 gap-2 border-border/80 bg-card/60"
            onClick={onHint}
            disabled={Boolean(hint)}
          >
            <Lightbulb className="h-4 w-4" />
            Approach hint
          </Button>
          {hint && <p className="mt-3 text-sm leading-6 text-foreground/80">{hint}</p>}
        </div>
      )}
    </article>
  );
}

export default function AssessmentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<AssessmentGeneratorType>("mcq");
  const [assessmentScope, setAssessmentScope] = useState<AssessmentScope>("daily");
  const [durationMinutes, setDurationMinutes] = useState("20");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answerStats, setAnswerStats] = useState<Record<string, { answerChanges: number; firstAnsweredAt?: string; lastAnsweredAt?: string }>>({});
  const [approachHints, setApproachHints] = useState<Record<string, string>>({});
  const [now, setNow] = useState(() => Date.now());
  const [missingPlanDialogOpen, setMissingPlanDialogOpen] = useState(false);
  const [planChoiceState, setPlanChoiceState] = useState<"pending" | "accepted" | "declined">("pending");

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
      setAnswerStats({});
      setApproachHints({});
      return;
    }

    const seededAnswers = Object.fromEntries(
      Object.entries(currentSession.submission?.answers || {}).map(([key, value]) => [key, String(value || "")]),
    );
    setAnswers(seededAnswers);
    setAnswerStats((currentSession.submission?.answerStats || {}) as Record<string, { answerChanges: number; firstAnsweredAt?: string; lastAnsweredAt?: string }>);
    setApproachHints({});
  }, [currentSession]);

  useEffect(() => {
    if (!currentSession || currentSession.status === "completed") {
      return undefined;
    }

    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [currentSession]);

  const startAssessmentMutation = useMutation({
    mutationFn: () =>
      generateAssessment({
        assessmentType: selectedType,
        assessmentScope,
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

      return submitAssessment(currentSession.id, { answers, answerStats });
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

  const deleteAssessmentMutation = useMutation({
    mutationFn: (id: string) => deleteAssessmentSession(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["assessments", "overview"] });
      toast.success("Assessment deleted.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete assessment.");
    },
  });

  const clearAssessmentHistoryMutation = useMutation({
    mutationFn: () => clearAssessmentHistory(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["assessments", "overview"] });
      toast.success("Assessment history cleared.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to clear assessment history.");
    },
  });

  const unansweredCount = useMemo(() => {
    if (!currentSession || currentSession.status === "completed") {
      return 0;
    }

    return currentSession.questions.filter((question) => !String(answers[question.id] || "").trim()).length;
  }, [answers, currentSession]);

  const timeLeftSeconds = useMemo(() => {
    if (!currentSession?.startedAt || currentSession.status === "completed") {
      return null;
    }

    const startedAt = new Date(currentSession.startedAt).getTime();
    const endsAt = startedAt + currentSession.durationMinutes * 60 * 1000;
    return Math.ceil((endsAt - now) / 1000);
  }, [currentSession, now]);
  const isTimeExpired = timeLeftSeconds !== null && timeLeftSeconds <= 0;
  const pressurePercent = timeLeftSeconds === null || !currentSession
    ? 100
    : Math.max(0, Math.min(100, (timeLeftSeconds / (currentSession.durationMinutes * 60)) * 100));
  const pressureTone = pressurePercent <= 20
    ? "bg-destructive"
    : pressurePercent <= 45
      ? "bg-amber-400"
      : "bg-emerald-400";
  const answerChangeCount = countAnswerChanges(currentSession?.submission?.answerStats);

  function updateAnswer(question: AssessmentQuestion, next: string) {
    setAnswers((current) => ({ ...current, [question.id]: next }));
    setAnswerStats((current) => {
      const existing = current[question.id];
      const answeredAt = new Date().toISOString();

      return {
        ...current,
        [question.id]: {
          answerChanges: existing ? existing.answerChanges + 1 : 0,
          firstAnsweredAt: existing?.firstAnsweredAt || answeredAt,
          lastAnsweredAt: answeredAt,
        },
      };
    });
  }

  function openCodingAssessment(question: AssessmentQuestion) {
    if (!currentSession) {
      return;
    }

    updateAnswer(question, "Timed Coding Lab opened for this question.");

    const params = new URLSearchParams({
      assessmentId: currentSession.id,
      assessmentQuestionId: question.id,
      timeLimitMinutes: String(Math.max(5, question.averageTimeMinutes || currentSession.durationMinutes || 20)),
      title: question.referenceLabel || question.taskTitle || question.topic || "Assessment coding problem",
      description: question.prompt,
      returnTo: "/assessments",
    });
    const problemNumber = extractLeetCodeNumberFromQuestion(question);

    if (problemNumber) {
      params.set("problemNumber", problemNumber);
    }
    if (question.referenceUrl) {
      params.set("url", question.referenceUrl);
    }
    if (question.referenceLabel) {
      params.set("referenceLabel", question.referenceLabel);
    }

    navigate(`/coding-lab?${params.toString()}`);
  }

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
                        : currentSession.assessmentType === "ordering"
                          ? "Ordering drill"
                          : "Short programming"}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Started {formatDateTime(currentSession.startedAt)} / {currentSession.durationMinutes} total minutes / {currentSession.assessmentScope || "daily"} scope
                  </p>
                </div>

                <div className="rounded-full border border-border/80 bg-background/70 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {unansweredCount} unanswered
                </div>
              </div>

              {timeLeftSeconds !== null && (
                <div className="mt-5 rounded-[1.15rem] border border-border/80 bg-background/45 p-4">
                  <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    <span>Pressure clock</span>
                    <span>{isTimeExpired ? "Time expired" : formatTime(timeLeftSeconds)}</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted/45">
                    <div
                      className={`h-full rounded-full transition-all ${pressureTone}`}
                      style={{ width: `${pressurePercent}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="mt-6 space-y-4">
                {currentSession.questions.map((question) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    value={answers[question.id] || ""}
                    onChange={(next) => updateAnswer(question, next)}
                    disabled={isTimeExpired}
                    onHint={() =>
                      setApproachHints((current) => ({
                        ...current,
                        [question.id]: current[question.id] || buildApproachHint(question),
                      }))
                    }
                    hint={approachHints[question.id]}
                    onOpenCodingLab={() => openCodingAssessment(question)}
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
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Coverage</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[1rem] border border-border/70 bg-card/60 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Questions</p>
                      <p className="mt-2 font-heading text-3xl text-foreground">{currentSession.questions.length}</p>
                    </div>
                    <div className="rounded-[1rem] border border-border/70 bg-card/60 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Scope</p>
                      <p className="mt-2 font-heading text-2xl text-foreground capitalize">{currentSession.assessmentScope || "daily"}</p>
                    </div>
                    <div className="rounded-[1rem] border border-border/70 bg-card/60 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Strong answers</p>
                      <p className="mt-2 font-heading text-3xl text-foreground">
                        {currentSession.submission?.questionResults?.filter((result) => Number(result.score || 0) >= 0.75).length || 0}
                      </p>
                    </div>
                  </div>
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
                </div>

                {/* Adaptive Assessment & Plan Revision Engine (Student Authority) */}
                {(() => {
                  const recPlan = (currentSession.metadata?.recommendedPlan as Record<string, unknown>) || null;
                  const newReadiness = typeof currentSession.metadata?.newReadinessScore === "number"
                    ? Number(currentSession.metadata.newReadinessScore)
                    : null;
                  const readinessDelta = typeof currentSession.metadata?.readinessDelta === "number"
                    ? Number(currentSession.metadata.readinessDelta)
                    : null;
                  const isAccepted = planChoiceState === "accepted" || applyPlanUpdateMutation.isSuccess;
                  const isDeclined = planChoiceState === "declined";

                  return (
                    <div className="rounded-[1.15rem] border border-primary/30 bg-primary/5 p-5">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <span className="text-xs font-mono uppercase tracking-[0.18em] text-primary font-semibold">
                            Adaptive Assessment & Plan Revision
                          </span>
                          <h4 className="mt-1 font-heading text-xl text-foreground">
                            Readiness Score & Recommended Plan Update
                          </h4>
                        </div>
                        {newReadiness !== null && (
                          <div className="flex items-center gap-3">
                            <div className="rounded-xl border border-primary/20 bg-background/80 px-3.5 py-1.5 text-right">
                              <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground block">
                                Updated Readiness
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-heading text-xl font-bold text-foreground">
                                  {Math.round(newReadiness * 10) / 10}%
                                </span>
                                {readinessDelta !== null && readinessDelta !== 0 && (
                                  <span className={`text-xs font-mono font-medium ${readinessDelta > 0 ? "text-emerald-400" : "text-amber-400"}`}>
                                    ({readinessDelta > 0 ? `+${readinessDelta.toFixed(1)}%` : `${readinessDelta.toFixed(1)}%`})
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Multi-Aspect Scoring Breakdown */}
                      <div className="mt-4 grid gap-3 sm:grid-cols-3 text-xs">
                        <div className="rounded-lg border border-border/60 bg-background/50 p-3">
                          <span className="text-muted-foreground uppercase font-mono text-[10px]">Concept Mastery</span>
                          <p className="mt-1 font-medium text-foreground text-sm">
                            {Math.round(Number(currentSession.score || 0))}%
                          </p>
                          <span className="text-[11px] text-muted-foreground">Accuracy across topics</span>
                        </div>
                        <div className="rounded-lg border border-border/60 bg-background/50 p-3">
                          <span className="text-muted-foreground uppercase font-mono text-[10px]">Time Efficiency</span>
                          <p className="mt-1 font-medium text-foreground text-sm">
                            {Math.round(Math.min(100, Math.max(50, 100 - (answerChangeCount * 5))))}%
                          </p>
                          <span className="text-[11px] text-muted-foreground">Pacing & answer stability</span>
                        </div>
                        <div className="rounded-lg border border-border/60 bg-background/50 p-3">
                          <span className="text-muted-foreground uppercase font-mono text-[10px]">Role Alignment</span>
                          <p className="mt-1 font-medium text-foreground text-sm">
                            {currentSession.weakSpots.length === 0 ? "High (Clear)" : "Targeted Gaps"}
                          </p>
                          <span className="text-[11px] text-muted-foreground">
                            {currentSession.weakSpots.length === 0 ? "Ready for advanced tracks" : `${currentSession.weakSpots.length} weak areas`}
                          </span>
                        </div>
                      </div>

                      {/* Recommended Plan Details */}
                      <div className="mt-4 rounded-xl border border-border/70 bg-background/70 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs uppercase font-mono tracking-wider text-muted-foreground">
                            Proposed Focus: {String(recPlan?.focusShift || (currentSession.weakSpots.length ? "Weak Spot Remediation" : "Accelerated Track"))}
                          </span>
                          <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-mono text-primary border border-primary/20">
                            Student Authority Protected
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-foreground/90">
                          {String(
                            recPlan?.rationale ||
                              (currentSession.weakSpots.length
                                ? `Based on this assessment, we recommend prioritizing ${currentSession.weakSpots.join(", ")} in your daily roadmap.`
                                : "Great performance! We recommend advancing your plan to higher-difficulty interview questions.")
                          )}
                        </p>
                        {!!(recPlan?.recommendedTopics || currentSession.weakSpots)?.length && (
                          <div className="mt-3 flex flex-wrap items-center gap-1.5">
                            <span className="text-xs text-muted-foreground mr-1">Recommended Topics:</span>
                            {((recPlan?.recommendedTopics as string[]) || currentSession.weakSpots).map((topic) => (
                              <span key={topic} className="rounded-md border border-border bg-card px-2 py-0.5 text-xs font-mono text-foreground">
                                {topic}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Student Authority Decision Area */}
                      <div className="mt-4 pt-3 border-t border-border/60">
                        {isAccepted ? (
                          <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-200">
                            <Check className="h-5 w-5 shrink-0 text-emerald-400" />
                            <div className="text-xs leading-5">
                              <strong className="block font-medium text-emerald-300">Recommended Plan Applied</strong>
                              Your active Prep Architect roadmap and daily tasks have been updated with these adapted topics.
                            </div>
                          </div>
                        ) : isDeclined ? (
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-border/70 bg-card/60 p-3">
                            <div className="text-xs leading-5 text-muted-foreground">
                              <strong className="block font-medium text-foreground">Existing Plan Retained</strong>
                              Your roadmap remains on its current course. You can switch to the recommended plan at any time.
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs shrink-0"
                              onClick={() => setPlanChoiceState("pending")}
                            >
                              Review Recommendation
                            </Button>
                          </div>
                        ) : (
                          <div>
                            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-200/90 mb-3">
                              Notice: Your current plan will <strong>not</strong> change unless you explicitly confirm below. You have the choice to adopt this recommendation or stick with your current plan.
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                              <Button
                                type="button"
                                className="h-10 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                                onClick={() => {
                                  applyPlanUpdateMutation.mutate(undefined, {
                                    onSuccess: () => setPlanChoiceState("accepted"),
                                  });
                                }}
                                disabled={applyPlanUpdateMutation.isPending}
                              >
                                {applyPlanUpdateMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                                {applyPlanUpdateMutation.isPending ? "Applying Recommended Plan..." : "Switch to Recommended Plan"}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-10 gap-2 border-border/80 bg-background/80"
                                onClick={() => {
                                  setPlanChoiceState("declined");
                                  toast.info("Existing plan kept. No changes were made to your roadmap.");
                                }}
                                disabled={applyPlanUpdateMutation.isPending}
                              >
                                Keep Existing Plan
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                <div className="rounded-[1.15rem] border border-border/80 bg-background/45 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Session debrief</p>
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    {answerChangeCount > 0
                      ? `You changed answers ${answerChangeCount} time${answerChangeCount === 1 ? "" : "s"}, which signals uncertainty worth reviewing before the next timed run.`
                      : "Your submitted answers were steady. Review the weak spots and test whether that confidence holds under the next timer."}
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
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Recent assessments</p>
          {recentSessions.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 border-destructive/30 px-2 text-xs text-destructive hover:bg-destructive/10"
              onClick={() => clearAssessmentHistoryMutation.mutate()}
              disabled={clearAssessmentHistoryMutation.isPending}
              title="Clear assessment history"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Clear History
            </Button>
          )}
        </div>
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
                    {session.assessmentScope || "daily"} scope
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.16em] ${scoreTone(session.score)}`}>
                    {session.status === "completed" ? `${Math.round(session.score)}%` : session.status}
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteAssessmentMutation.mutate(session.id)}
                    disabled={deleteAssessmentMutation.isPending}
                    className="rounded-lg p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    title="Delete assessment attempt"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
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
