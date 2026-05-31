import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CheckCircle2,
  Code2,
  Database,
  Loader2,
  Play,
  RefreshCcw,
  Send,
  TerminalSquare,
} from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import PageStatusPanel from "@/components/PageStatusPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQueryErrorLogger } from "@/hooks/use-query-error-logger";
import {
  fetchCodingLanguages,
  fetchCodingSubmissions,
  fetchCodingTask,
  resolveCodingProblem,
  runCodingCode,
  submitCodingCode,
  type CodingLanguage,
  type CodingProblem,
  type CodingSubmission,
  type CodingTestCase,
} from "@/lib/api";

const FALLBACK_STARTER_CODE: Record<string, string> = {
  python: "# Write your solution here\n",
  c: "#include <stdio.h>\n\nint main(void) {\n  return 0;\n}\n",
  cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  return 0;\n}\n",
  java: "class Main {\n  public static void main(String[] args) {\n  }\n}\n",
  javascript: "function solve() {\n  // Write your solution here\n}\n\nsolve();\n",
  typescript: "function solve(): void {\n  // Write your solution here\n}\n\nsolve();\n",
  go: "package main\n\nimport \"fmt\"\n\nfunc main() {\n  fmt.Println(\"Hello, PlacePrep\")\n}\n",
  rust: "fn main() {\n    println!(\"Hello, PlacePrep\");\n}\n",
  csharp: "using System;\n\nclass Program {\n  static void Main() {\n  }\n}\n",
  mysql: "-- Write your MySQL query here\n",
  postgresql: "-- Write your PostgreSQL query here\n",
};

function isSqlLanguage(language: string) {
  return ["mysql", "postgresql"].includes(language);
}

function statusLabel(status?: string | null) {
  return String(status || "not_run").replace(/_/g, " ");
}

function statusTone(status?: string | null) {
  if (status === "accepted") {
    return "border-emerald-400/25 bg-emerald-500/10 text-emerald-200";
  }
  if (status === "analysis_only") {
    return "border-sky-400/25 bg-sky-500/10 text-sky-200";
  }
  if (["wrong_answer", "compile_error", "runtime_error", "timeout", "failed"].includes(String(status))) {
    return "border-rose-400/25 bg-rose-500/10 text-rose-200";
  }
  return "border-border/80 bg-background/70 text-muted-foreground";
}

function compactProblemSource(problem?: CodingProblem | null) {
  if (!problem) {
    return "Manual problem";
  }

  const parts = [problem.platform, problem.difficulty].filter(Boolean);
  return parts.length ? parts.join(" / ") : "Practice problem";
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.map((entry) => String(entry || "").trim()).filter(Boolean)
    : [];
}

function inferStarterLanguageKey(language: string, languageInfo?: CodingLanguage | null) {
  const hint = [
    language,
    languageInfo?.label,
    languageInfo?.providerName,
  ].join(" ").toLowerCase();

  if (hint.includes("python")) return "python";
  if (hint.includes("javascript") || hint.includes("node.js") || hint.includes("nodejs")) return "javascript";
  if (hint.includes("typescript")) return "typescript";
  if (hint.includes("golang") || /\bgo\b/.test(hint)) return "go";
  if (hint.includes("rust")) return "rust";
  if (hint.includes("c#") || hint.includes("csharp")) return "csharp";
  if (hint.includes("c++") || hint.includes("g++") || hint.includes("cpp")) return "cpp";
  if (/\bc\b/.test(hint) || hint.includes("gcc")) return "c";
  if (hint.includes("java")) return "java";
  if (hint.includes("mysql")) return "mysql";
  if (hint.includes("postgres")) return "postgresql";

  return FALLBACK_STARTER_CODE[language] ? language : "python";
}

function getStarterCodeForLanguage(problem: CodingProblem | null, language: string, languageInfo?: CodingLanguage | null) {
  const starterKey = inferStarterLanguageKey(language, languageInfo);
  const starter = problem?.starterCode?.[language] || problem?.starterCode?.[starterKey];
  return starter || FALLBACK_STARTER_CODE[starterKey] || FALLBACK_STARTER_CODE.python;
}

function looksLikeLeetCodeNumber(value: string) {
  return /^\s*(?:leetcode|lc)?\s*#?\s*\d{1,5}\s*$/i.test(value);
}

function looksLikeUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function looksLikeLeetCodeSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)+$/i.test(value.trim());
}

function extractLeetCodeNumber(value: string) {
  return value.match(/\d{1,5}/)?.[0] || "";
}

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function buildProblemPayloadFromSearch(searchParams: URLSearchParams) {
  const title = searchParams.get("title") || searchParams.get("referenceLabel") || "";
  const url = searchParams.get("url") || "";
  const problemNumber = searchParams.get("problemNumber") || extractLeetCodeNumber(title);
  const description = searchParams.get("description") || "";

  return {
    platform: problemNumber || /leetcode\.com/i.test(url) ? "leetcode" : undefined,
    title: problemNumber ? undefined : title,
    problemTitle: problemNumber ? undefined : title,
    problemNumber: problemNumber || undefined,
    url: url || undefined,
    description,
  };
}

function buildManualProblemPayload({
  title,
  url,
  description,
}: {
  title: string;
  url: string;
  description: string;
}) {
  const lookup = title.trim();
  const sourceUrl = url.trim() || (looksLikeUrl(lookup) ? lookup : "");
  const number = looksLikeLeetCodeNumber(lookup) ? extractLeetCodeNumber(lookup) : "";
  const slug = !sourceUrl && looksLikeLeetCodeSlug(lookup) ? lookup.toLowerCase() : "";
  const shouldTreatAsLeetCode = Boolean(number || slug || /leetcode\.com/i.test(sourceUrl));

  return {
    platform: shouldTreatAsLeetCode ? "leetcode" : undefined,
    title: !number && !slug && !looksLikeUrl(lookup) ? lookup : undefined,
    problemTitle: !number && !slug && !looksLikeUrl(lookup) ? lookup : undefined,
    problemNumber: number || undefined,
    slug: slug || undefined,
    url: sourceUrl || undefined,
    description,
  };
}

function formatProblemDescription(value: string) {
  return String(value || "")
    .replace(/\s+(Example\s+\d+:)/gi, "\n\n$1\n")
    .replace(/\s+(Input:|Output:|Explanation:|Constraints:)/gi, "\n$1")
    .replace(/\s+(Table:\s*)/gi, "\n\n$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function ProblemBrief({
  problem,
  onUseTestCase,
}: {
  problem: CodingProblem | null;
  onUseTestCase?: (testCase: CodingTestCase) => void;
}) {
  if (!problem) {
    return (
      <div className="mt-5 rounded-[1rem] border border-border/70 bg-background/45 p-5">
        <p className="text-sm leading-7 text-muted-foreground">
          Resolve a LeetCode number, slug, or link to load a structured problem statement here.
        </p>
      </div>
    );
  }

  const description = formatProblemDescription(problem.description || "");
  const examples = stringList(problem.examples).filter((example) => !description.includes(example));
  const topics = stringList(problem.constraints);
  const testCases = problem.testCases || [];

  return (
    <div className="mt-5 rounded-[1rem] border border-border/70 bg-background/45 p-5">
      <div className="flex flex-wrap items-center gap-2">
        {problem.number && (
          <span className="rounded-full border border-border/70 bg-card/70 px-3 py-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            #{problem.number}
          </span>
        )}
        {problem.difficulty && (
          <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs uppercase tracking-[0.14em] text-primary">
            {problem.difficulty}
          </span>
        )}
        {problem.platform && (
          <span className="rounded-full border border-border/70 bg-card/70 px-3 py-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            {problem.platform}
          </span>
        )}
      </div>

      {problem.extractionMessage && (
        <div className="mt-4 rounded-[0.85rem] border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
          {problem.extractionMessage}
        </div>
      )}

      {description ? (
        <div className="mt-4 max-h-[34rem] overflow-auto rounded-[0.85rem] border border-border/60 bg-card/45 p-4">
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-foreground/86">
            {description}
          </pre>
        </div>
      ) : (
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          No statement text is loaded yet. Paste the prompt into the notes box if the original platform blocks extraction.
        </p>
      )}

      {!!examples.length && (
        <div className="mt-4 grid gap-3">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Examples</p>
          {examples.map((example, index) => (
            <pre
              key={`${example}-${index}`}
              className="whitespace-pre-wrap break-words rounded-[0.85rem] border border-border/60 bg-card/55 p-3 font-mono text-xs leading-6 text-foreground/82"
            >
              {example}
            </pre>
          ))}
        </div>
      )}

      {!!topics.length && (
        <div className="mt-4 flex flex-wrap gap-2">
          {topics.map((topic) => (
            <span
              key={topic}
              className="rounded-full border border-border/70 bg-card/70 px-3 py-1 text-xs text-muted-foreground"
            >
              {topic}
            </span>
          ))}
        </div>
      )}

      {!!testCases.length && (
        <div className="mt-4 grid gap-3">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Lab test cases</p>
          {testCases.map((testCase, index) => (
            <button
              key={`${testCase.name || "case"}-${index}`}
              type="button"
              className="rounded-[0.85rem] border border-border/70 bg-card/55 p-3 text-left transition hover:border-primary/35 hover:bg-background/60"
              onClick={() => onUseTestCase?.(testCase)}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-[0.16em] text-foreground/80">
                  {testCase.name || `Case ${index + 1}`}
                </p>
                <span className="text-[10px] uppercase tracking-[0.14em] text-primary">Use case</span>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <pre className="whitespace-pre-wrap break-words rounded-lg border border-border/60 bg-background/65 p-3 font-mono text-xs leading-5 text-foreground/80">
                  {testCase.input || "No input"}
                </pre>
                <pre className="whitespace-pre-wrap break-words rounded-lg border border-border/60 bg-background/65 p-3 font-mono text-xs leading-5 text-foreground/80">
                  {testCase.expectedOutput || "No expected output"}
                </pre>
              </div>
              {testCase.explanation && (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{testCase.explanation}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ResultPanel({ result }: { result: CodingSubmission | null }) {
  if (!result) {
    return (
      <div className="rounded-[1.15rem] border border-border/80 bg-background/45 p-5">
        <div className="flex items-center gap-3 text-foreground">
          <TerminalSquare className="h-5 w-5 text-primary" />
          <p className="text-base">No sandbox result yet.</p>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Run or submit code to see execution output, scoring, and the review notes.
        </p>
      </div>
    );
  }

  const recommendations = stringList(result.rubric?.recommendations);
  const summary = typeof result.analysis?.summary === "string"
    ? result.analysis.summary
    : "Review the run output and improve the highest-impact area.";
  const detectedTime = String(result.rubric?.detectedTimeComplexity || result.rubric?.detectedComplexity || "not stated");
  const detectedSpace = String(result.rubric?.detectedSpaceComplexity || "not stated");
  const speedScore = Number(result.rubric?.speedScore || 0);

  return (
    <div className="rounded-[1.15rem] border border-border/80 bg-background/45 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Run result</p>
          <h3 className="mt-2 font-heading text-3xl text-foreground">{Math.round(result.score)}% score</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{summary}</p>
        </div>
        <div className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.16em] ${statusTone(result.status)}`}>
          {statusLabel(result.status)}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-[1rem] border border-border/70 bg-card/60 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Runtime</p>
          <p className="mt-2 text-lg text-foreground">{result.time ? `${result.time}s` : "n/a"}</p>
          <p className="mt-1 text-xs text-muted-foreground">{result.memory ? `${result.memory} KB` : "memory n/a"}</p>
        </div>
        <div className="rounded-[1rem] border border-border/70 bg-card/60 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Time / space</p>
          <p className="mt-2 text-sm text-foreground">{detectedTime}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detectedSpace}</p>
        </div>
        <div className="rounded-[1rem] border border-border/70 bg-card/60 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Solve speed</p>
          <p className="mt-2 text-lg text-foreground">{speedScore ? `${Math.round(speedScore)}%` : "n/a"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {result.rubric?.durationSeconds ? `${formatDuration(Number(result.rubric.durationSeconds))} elapsed` : "timer not supplied"}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {result.stdout && (
          <pre className="max-h-44 overflow-auto rounded-[1rem] border border-border/70 bg-card/70 p-4 text-sm leading-6 text-foreground/85">
            {result.stdout}
          </pre>
        )}
        {(result.stderr || result.compileOutput) && (
          <pre className="max-h-44 overflow-auto rounded-[1rem] border border-rose-400/20 bg-rose-500/10 p-4 text-sm leading-6 text-rose-100">
            {[result.compileOutput, result.stderr].filter(Boolean).join("\n")}
          </pre>
        )}
      </div>

      {!!recommendations.length && (
        <div className="mt-5 rounded-[1rem] border border-border/70 bg-card/60 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Review notes</p>
          <div className="mt-3 grid gap-2">
            {recommendations.map((item) => (
              <p key={item} className="text-sm leading-6 text-foreground/82">{item}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CodingLabPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [selectedLanguage, setSelectedLanguage] = useState("python");
  const [sourceCode, setSourceCode] = useState("");
  const [stdin, setStdin] = useState("");
  const [expectedOutput, setExpectedOutput] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [resolvedProblem, setResolvedProblem] = useState<CodingProblem | null>(null);
  const [lastResult, setLastResult] = useState<CodingSubmission | null>(null);
  const [sourceTouched, setSourceTouched] = useState(false);
  const [queryBootstrapped, setQueryBootstrapped] = useState(false);
  const [workspaceStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  const assessmentContext = useMemo(() => {
    const assessmentId = searchParams.get("assessmentId") || "";
    const assessmentQuestionId = searchParams.get("assessmentQuestionId") || "";
    const timeLimitMinutes = Number(searchParams.get("timeLimitMinutes") || 0);

    return {
      assessmentId,
      assessmentQuestionId,
      returnTo: searchParams.get("returnTo") || "",
      timeLimitSeconds: timeLimitMinutes > 0 ? Math.round(timeLimitMinutes * 60) : 0,
    };
  }, [searchParams]);

  const languagesQuery = useQuery({
    queryKey: ["coding", "languages"],
    queryFn: fetchCodingLanguages,
  });
  const taskQuery = useQuery({
    queryKey: ["coding", "task", taskId],
    queryFn: () => fetchCodingTask(taskId as string),
    enabled: Boolean(taskId),
  });
  const submissionsQuery = useQuery({
    queryKey: ["coding", "submissions", { limit: 8 }],
    queryFn: () => fetchCodingSubmissions({ limit: 8 }),
    enabled: !taskId,
  });

  useQueryErrorLogger("CodingLabPage:languages", languagesQuery.error);
  useQueryErrorLogger("CodingLabPage:task", taskQuery.error);
  useQueryErrorLogger("CodingLabPage:submissions", submissionsQuery.error);

  const taskWorkspace = taskQuery.data || null;
  const problem = taskWorkspace?.problem || resolvedProblem;
  const languages = useMemo(() => {
    const merged = taskWorkspace?.languages?.length ? taskWorkspace.languages : languagesQuery.data || [];
    return merged.length ? merged : Object.keys(FALLBACK_STARTER_CODE).map((key) => ({
      key,
      label: key === "cpp" ? "C++" : key[0].toUpperCase() + key.slice(1),
      enabled: false,
      unavailableReason: "Language registry is still loading.",
    }));
  }, [languagesQuery.data, taskWorkspace?.languages]);
  const selectedLanguageInfo = languages.find((language) => language.key === selectedLanguage);
  const submissions = taskWorkspace?.submissions || submissionsQuery.data || [];
  const isLoading = (taskId && taskQuery.isPending) || languagesQuery.isPending;
  const elapsedSeconds = Math.max(0, Math.round((now - workspaceStartedAt) / 1000));
  const labTimeLeftSeconds = assessmentContext.timeLimitSeconds
    ? Math.max(0, assessmentContext.timeLimitSeconds - elapsedSeconds)
    : null;
  const labPressurePercent = labTimeLeftSeconds === null
    ? 100
    : Math.max(0, Math.min(100, (labTimeLeftSeconds / assessmentContext.timeLimitSeconds) * 100));
  const labPressureTone = labPressurePercent <= 20
    ? "bg-destructive"
    : labPressurePercent <= 45
      ? "bg-amber-400"
      : "bg-emerald-400";

  useEffect(() => {
    const firstEnabled = languages.find((language) => language.enabled)?.key || languages[0]?.key;
    if (firstEnabled && !languages.some((language) => language.key === selectedLanguage)) {
      setSelectedLanguage(firstEnabled);
    }
  }, [languages, selectedLanguage]);

  useEffect(() => {
    if (!sourceTouched && !sourceCode.trim()) {
      setSourceCode(getStarterCodeForLanguage(problem, selectedLanguage, selectedLanguageInfo));
    }
  }, [problem, selectedLanguage, selectedLanguageInfo, sourceCode, sourceTouched]);

  useEffect(() => {
    if (!assessmentContext.timeLimitSeconds) {
      return undefined;
    }

    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [assessmentContext.timeLimitSeconds]);

  useEffect(() => {
    const firstCase = problem?.testCases?.[0];
    if (firstCase && !stdin.trim() && !expectedOutput.trim()) {
      setStdin(firstCase.input || "");
      setExpectedOutput(firstCase.expectedOutput || "");
    }
  }, [expectedOutput, problem?.number, problem?.slug, problem?.testCases, stdin]);

  useEffect(() => {
    if (taskWorkspace?.submissions?.[0]) {
      setLastResult(taskWorkspace.submissions[0]);
    }
  }, [taskWorkspace?.submissions]);

  const resolveProblemMutation = useMutation({
    mutationFn: (payload?: ReturnType<typeof buildProblemPayloadFromSearch>) =>
      resolveCodingProblem(payload || buildManualProblemPayload({
        title: manualTitle,
        url: manualUrl,
        description: manualDescription,
      })),
    onSuccess: (nextProblem) => {
      setResolvedProblem(nextProblem);
      if (!sourceTouched) {
        setSourceCode(getStarterCodeForLanguage(nextProblem, selectedLanguage, selectedLanguageInfo));
      }
      if (nextProblem.testCases?.[0] && !stdin.trim() && !expectedOutput.trim()) {
        setStdin(nextProblem.testCases[0].input || "");
        setExpectedOutput(nextProblem.testCases[0].expectedOutput || "");
      }
      setManualTitle(nextProblem.number ? `${nextProblem.number}. ${nextProblem.title}` : nextProblem.title);
      setManualUrl(nextProblem.url || "");
      toast.success("Problem workspace prepared.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to resolve this problem.");
    },
  });

  useEffect(() => {
    if (taskId || queryBootstrapped) {
      return;
    }

    const hasQueryProblem = Boolean(
      searchParams.get("problemNumber")
      || searchParams.get("url")
      || searchParams.get("title")
      || searchParams.get("description"),
    );

    if (!hasQueryProblem) {
      return;
    }

    const title = searchParams.get("title") || searchParams.get("referenceLabel") || "";
    const url = searchParams.get("url") || "";
    const description = searchParams.get("description") || "";
    setManualTitle(title || searchParams.get("problemNumber") || "Assessment coding problem");
    setManualUrl(url);
    setManualDescription(description);
    setQueryBootstrapped(true);
    resolveProblemMutation.mutate(buildProblemPayloadFromSearch(searchParams));
  }, [queryBootstrapped, resolveProblemMutation, searchParams, taskId]);

  function buildExecutionPayload() {
    return {
      taskId,
      language: selectedLanguage,
      sourceCode,
      stdin,
      expectedOutput,
      durationSeconds: Math.max(0, Math.round((Date.now() - workspaceStartedAt) / 1000)),
      timeLimitSeconds: assessmentContext.timeLimitSeconds || undefined,
      assessmentId: assessmentContext.assessmentId || undefined,
      assessmentQuestionId: assessmentContext.assessmentQuestionId || undefined,
      problem: problem || {
        ...buildManualProblemPayload({
          title: manualTitle || "Manual Coding Lab problem",
          url: manualUrl,
          description: manualDescription,
        }),
        title: manualTitle || "Manual Coding Lab problem",
      },
    };
  }

  const runMutation = useMutation({
    mutationFn: () => runCodingCode(buildExecutionPayload()),
    onSuccess: async (result) => {
      setLastResult(result);
      await queryClient.invalidateQueries({ queryKey: ["coding", "task", taskId] });
      await queryClient.invalidateQueries({ queryKey: ["coding", "submissions"] });
      toast.success("Sandbox run complete.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to run code.");
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => submitCodingCode(buildExecutionPayload()),
    onSuccess: async (result) => {
      setLastResult(result);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["coding", "task", taskId] }),
        queryClient.invalidateQueries({ queryKey: ["coding", "submissions"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks", "today"] }),
        queryClient.invalidateQueries({ queryKey: ["progress-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["assessments", "overview"] }),
      ]);
      toast.success("Final submission recorded.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to submit code.");
    },
  });

  const runDisabled = !sourceCode.trim()
    || runMutation.isPending
    || submitMutation.isPending;

  if (isLoading) {
    return (
      <div className="surface-panel p-6 md:p-7">
        <div className="flex items-center gap-3 text-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p>Preparing Coding Lab...</p>
        </div>
      </div>
    );
  }

  if (taskId && taskQuery.isError) {
    return (
      <PageStatusPanel
        eyebrow="Coding Lab"
        title="Coding task could not be loaded."
        description="The workspace stayed protected. Retry the task fetch or return to the task board."
        actionLabel="Retry"
        onAction={() => void taskQuery.refetch()}
        tone="danger"
      />
    );
  }

  return (
    <div className="grid gap-6">
      <section className="surface-panel-strong p-6 md:p-7">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="section-label">Coding Lab</p>
            <h2 className="mt-2 font-heading text-4xl text-foreground md:text-5xl">
              Run the problem before you call the task done.
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-foreground/80">
              Practice DSA, SQL, and implementation tasks with sandbox feedback, a scoring rubric, and automatic task progress when the final submission is strong.
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-background/40 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Workspace</p>
            <p className="mt-2 font-heading text-2xl text-foreground">
              {taskWorkspace?.task?.title || problem?.title || "Manual practice"}
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {compactProblemSource(problem)}
            </p>
          </div>
        </div>
      </section>

      {assessmentContext.assessmentId && (
        <section className="surface-panel p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Timed assessment lab</p>
              <p className="mt-2 text-sm leading-6 text-foreground/82">
                This workspace is linked to your short programming assessment. Final scoring includes correctness, time complexity,
                space complexity, and how quickly you finish.
              </p>
            </div>
            {assessmentContext.returnTo && (
              <Button
                type="button"
                variant="outline"
                className="h-10 gap-2 border-border/80 bg-background/70"
                onClick={() => navigate(assessmentContext.returnTo)}
              >
                Back to assessment
              </Button>
            )}
          </div>

          {labTimeLeftSeconds !== null && (
            <div className="mt-4">
              <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                <span>Lab timer</span>
                <span>{labTimeLeftSeconds <= 0 ? "Time expired" : formatDuration(labTimeLeftSeconds)}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted/45">
                <div
                  className={`h-full rounded-full transition-all ${labPressureTone}`}
                  style={{ width: `${labPressurePercent}%` }}
                />
              </div>
            </div>
          )}
        </section>
      )}

      {!taskId && (
        <section className="surface-panel p-6 md:p-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Manual problem</p>
              <h3 className="mt-2 font-heading text-3xl text-foreground">Prepare a workspace</h3>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-10 gap-2 border-border/80 bg-background/70"
              onClick={() => navigate("/tasks")}
            >
              <Code2 className="h-4 w-4" />
              Task board
            </Button>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
            <Input
              value={manualTitle}
              onChange={(event) => setManualTitle(event.target.value)}
              placeholder="LeetCode #, slug, title, or URL"
              className="h-11 border-border/80 bg-background/70"
            />
            <Input
              value={manualUrl}
              onChange={(event) => setManualUrl(event.target.value)}
              placeholder="Optional problem URL"
              className="h-11 border-border/80 bg-background/70"
            />
            <Button
              type="button"
              className="h-11 gap-2"
              disabled={resolveProblemMutation.isPending || (!manualTitle.trim() && !manualUrl.trim() && !manualDescription.trim())}
              onClick={() => resolveProblemMutation.mutate()}
            >
              {resolveProblemMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Resolve
            </Button>
          </div>
          <Textarea
            value={manualDescription}
            onChange={(event) => setManualDescription(event.target.value)}
            placeholder="Optional problem statement or notes"
            className="mt-3 min-h-[100px] border-border/80 bg-background/70"
          />
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <section className="surface-panel p-6 md:p-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Editor</p>
              <h3 className="mt-2 font-heading text-3xl text-foreground">
                {problem?.title || taskWorkspace?.task?.title || "Coding workspace"}
              </h3>
              {problem?.url && (
                <a
                  href={problem.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-2 text-sm text-primary transition hover:text-foreground"
                >
                  Open original problem
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              )}
            </div>

            <Select value={selectedLanguage} onValueChange={(value) => {
              const nextLanguageInfo = languages.find((language) => language.key === value);
              setSelectedLanguage(value);
              if (!sourceTouched) {
                setSourceCode(getStarterCodeForLanguage(problem, value, nextLanguageInfo));
              }
            }}>
              <SelectTrigger className="h-11 w-full border-border/80 bg-background/70 md:w-[220px]">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                {languages.map((language: CodingLanguage) => (
                  <SelectItem key={language.key} value={language.key}>
                    {language.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedLanguageInfo?.setupWarning && (
            <div className="mt-4 rounded-[1rem] border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
              {selectedLanguageInfo.setupWarning}
            </div>
          )}
          {selectedLanguageInfo?.unavailableReason && !selectedLanguageInfo.setupWarning && (
            <div className="mt-4 rounded-[1rem] border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
              {selectedLanguageInfo.unavailableReason}
            </div>
          )}

          <ProblemBrief
            problem={problem}
            onUseTestCase={(testCase) => {
              setStdin(testCase.input || "");
              setExpectedOutput(testCase.expectedOutput || "");
              toast.success("Test case loaded into the runner.");
            }}
          />

          <div className="mt-5 grid gap-4">
            <div>
              <Label htmlFor="source-code" className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Source code
              </Label>
              <Textarea
                id="source-code"
                value={sourceCode}
                onChange={(event) => {
                  setSourceTouched(true);
                  setSourceCode(event.target.value);
                }}
                className="mt-3 min-h-[360px] border-border/80 bg-[hsl(240_13%_5%)] font-mono text-sm leading-6 text-foreground"
                spellCheck={false}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="stdin" className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Input
                </Label>
                <Textarea
                  id="stdin"
                  value={stdin}
                  onChange={(event) => setStdin(event.target.value)}
                  className="mt-3 min-h-[130px] border-border/80 bg-background/70 font-mono text-sm"
                  spellCheck={false}
                />
              </div>
              <div>
                <Label htmlFor="expected-output" className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Expected output
                </Label>
                <Textarea
                  id="expected-output"
                  value={expectedOutput}
                  onChange={(event) => setExpectedOutput(event.target.value)}
                  className="mt-3 min-h-[130px] border-border/80 bg-background/70 font-mono text-sm"
                  spellCheck={false}
                />
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              type="button"
              className="h-11 gap-2"
              disabled={runDisabled}
              onClick={() => runMutation.mutate()}
            >
              {runMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {runMutation.isPending ? "Running..." : "Run code"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2 border-border/80 bg-background/70"
              disabled={runDisabled || submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
            >
              {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {submitMutation.isPending ? "Submitting..." : "Submit final"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11 gap-2 text-muted-foreground"
              onClick={() => {
                setSourceTouched(false);
                setSourceCode(getStarterCodeForLanguage(problem, selectedLanguage, selectedLanguageInfo));
              }}
            >
              <RefreshCcw className="h-4 w-4" />
              Reset starter
            </Button>
          </div>
        </section>

        <aside className="grid gap-6 content-start">
          <ResultPanel result={lastResult} />

          <section className="surface-panel p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Submission history</p>
                <h3 className="mt-2 font-heading text-2xl text-foreground">Recent runs</h3>
              </div>
              {isSqlLanguage(selectedLanguage) ? (
                <Database className="h-5 w-5 text-primary" />
              ) : (
                <Code2 className="h-5 w-5 text-primary" />
              )}
            </div>

            <div className="mt-4 grid gap-3">
              {submissions.length ? submissions.map((submission) => (
                <button
                  key={submission.id}
                  type="button"
                  onClick={() => setLastResult(submission)}
                  className="rounded-[1rem] border border-border/80 bg-card/60 px-4 py-3 text-left transition hover:border-primary/30 hover:bg-background/60"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-foreground">{submission.problem.title}</p>
                    <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${statusTone(submission.status)}`}>
                      {Math.round(submission.score)}%
                    </span>
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {submission.language} / {statusLabel(submission.status)}
                  </p>
                </button>
              )) : (
                <div className="rounded-[1rem] border border-border/80 bg-card/60 px-4 py-4 text-sm text-muted-foreground">
                  Runs and final submissions will appear here.
                </div>
              )}
            </div>
          </section>

          {lastResult?.status === "accepted" && lastResult.analysis?.finalized === true && (
            <div className="rounded-[1.15rem] border border-emerald-400/20 bg-emerald-500/10 p-4 text-emerald-100">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5" />
                <p className="text-sm">This submission is strong enough to count toward task progress.</p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
