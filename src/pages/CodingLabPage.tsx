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
import { useNavigate, useParams } from "react-router-dom";
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
} from "@/lib/api";

const FALLBACK_STARTER_CODE: Record<string, string> = {
  python: "# Write your solution here\n",
  c: "#include <stdio.h>\n\nint main(void) {\n  return 0;\n}\n",
  cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  return 0;\n}\n",
  java: "class Main {\n  public static void main(String[] args) {\n  }\n}\n",
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

function getStarterCode(problem: CodingProblem | null, language: string) {
  const starter = problem?.starterCode?.[language];
  return starter || FALLBACK_STARTER_CODE[language] || FALLBACK_STARTER_CODE.python;
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.map((entry) => String(entry || "").trim()).filter(Boolean)
    : [];
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
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Time</p>
          <p className="mt-2 text-lg text-foreground">{result.time ? `${result.time}s` : "n/a"}</p>
        </div>
        <div className="rounded-[1rem] border border-border/70 bg-card/60 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Memory</p>
          <p className="mt-2 text-lg text-foreground">{result.memory ? `${result.memory} KB` : "n/a"}</p>
        </div>
        <div className="rounded-[1rem] border border-border/70 bg-card/60 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Complexity</p>
          <p className="mt-2 text-lg text-foreground">{String(result.rubric?.detectedComplexity || "not stated")}</p>
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
  const canRunDisabledLanguage = isSqlLanguage(selectedLanguage);

  useEffect(() => {
    const firstEnabled = languages.find((language) => language.enabled)?.key || languages[0]?.key;
    if (firstEnabled && !languages.some((language) => language.key === selectedLanguage)) {
      setSelectedLanguage(firstEnabled);
    }
  }, [languages, selectedLanguage]);

  useEffect(() => {
    if (!sourceTouched && !sourceCode.trim()) {
      setSourceCode(getStarterCode(problem, selectedLanguage));
    }
  }, [problem, selectedLanguage, sourceCode, sourceTouched]);

  useEffect(() => {
    if (taskWorkspace?.submissions?.[0]) {
      setLastResult(taskWorkspace.submissions[0]);
    }
  }, [taskWorkspace?.submissions]);

  const resolveProblemMutation = useMutation({
    mutationFn: () =>
      resolveCodingProblem({
        title: manualTitle,
        url: manualUrl,
        description: manualDescription,
      }),
    onSuccess: (nextProblem) => {
      setResolvedProblem(nextProblem);
      if (!sourceTouched) {
        setSourceCode(getStarterCode(nextProblem, selectedLanguage));
      }
      toast.success("Problem workspace prepared.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to resolve this problem.");
    },
  });

  const runMutation = useMutation({
    mutationFn: () =>
      runCodingCode({
        taskId,
        language: selectedLanguage,
        sourceCode,
        stdin,
        expectedOutput,
        problem: problem || {
          title: manualTitle || "Manual Coding Lab problem",
          url: manualUrl,
          description: manualDescription,
        },
      }),
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
    mutationFn: () =>
      submitCodingCode({
        taskId,
        language: selectedLanguage,
        sourceCode,
        stdin,
        expectedOutput,
        problem: problem || {
          title: manualTitle || "Manual Coding Lab problem",
          url: manualUrl,
          description: manualDescription,
        },
      }),
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
    || submitMutation.isPending
    || (selectedLanguageInfo ? !selectedLanguageInfo.enabled && !canRunDisabledLanguage : false);

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
              placeholder="Problem title"
              className="h-11 border-border/80 bg-background/70"
            />
            <Input
              value={manualUrl}
              onChange={(event) => setManualUrl(event.target.value)}
              placeholder="LeetCode, HackerRank, or problem URL"
              className="h-11 border-border/80 bg-background/70"
            />
            <Button
              type="button"
              className="h-11 gap-2"
              disabled={resolveProblemMutation.isPending || (!manualTitle.trim() && !manualUrl.trim())}
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
              setSelectedLanguage(value);
              if (!sourceTouched) {
                setSourceCode(getStarterCode(problem, value));
              }
            }}>
              <SelectTrigger className="h-11 w-full border-border/80 bg-background/70 md:w-[220px]">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                {languages.map((language: CodingLanguage) => (
                  <SelectItem key={language.key} value={language.key}>
                    {language.label}{language.enabled ? "" : " (limited)"}
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
          {selectedLanguageInfo?.unavailableReason && !selectedLanguageInfo.enabled && !isSqlLanguage(selectedLanguage) && (
            <div className="mt-4 rounded-[1rem] border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm leading-6 text-rose-100">
              {selectedLanguageInfo.unavailableReason}
            </div>
          )}

          {problem?.description && (
            <div className="mt-5 max-h-56 overflow-auto rounded-[1rem] border border-border/70 bg-background/45 p-4 text-sm leading-6 text-foreground/82">
              {problem.description}
            </div>
          )}

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
                setSourceCode(getStarterCode(problem, selectedLanguage));
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
