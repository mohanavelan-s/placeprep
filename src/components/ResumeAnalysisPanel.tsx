import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  BriefcaseBusiness,
  FileText,
  FolderUp,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";

import PageStatusPanel from "@/components/PageStatusPanel";
import { useQueryErrorLogger } from "@/hooks/use-query-error-logger";
import {
  fetchLatestResumeAnalysis,
  fetchResumeAnalysisHistory,
  uploadResumeForAnalysis,
  type ResumeAnalysisRecord,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function formatBytes(sizeBytes: number) {
  if (!sizeBytes) {
    return "0 KB";
  }

  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(value?: string | null) {
  if (!value) {
    return "Just now";
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
    return "text-emerald-300 border-emerald-400/20 bg-emerald-500/10";
  }
  if (score >= 60) {
    return "text-amber-200 border-amber-300/20 bg-amber-400/10";
  }
  return "text-rose-200 border-rose-400/20 bg-rose-500/10";
}

function SectionCoveragePill({
  label,
  active,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs uppercase tracking-[0.16em] ${
        active
          ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
          : "border-border/80 bg-background/55 text-muted-foreground"
      }`}
    >
      {label}
    </span>
  );
}

function ResumeInsightCard({ resume }: { resume: ResumeAnalysisRecord | null }) {
  const sectionEntries = useMemo(
    () => [
      ["Summary", resume?.sections?.summary],
      ["Education", resume?.sections?.education],
      ["Experience", resume?.sections?.experience],
      ["Projects", resume?.sections?.projects],
      ["Skills", resume?.sections?.skills],
      ["Achievements", resume?.sections?.achievements],
    ] as const,
    [resume],
  );

  if (!resume) {
    return (
      <div className="rounded-[1.35rem] border border-border/80 bg-card/65 p-5">
        <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Latest analysis</p>
        <h4 className="mt-3 font-heading text-3xl text-foreground">No resume reviewed yet.</h4>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
          Upload a resume or paste your resume text to get a score, strengths, improvements, and section-level AI review.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[1.35rem] border border-border/80 bg-card/65 p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Latest analysis</p>
          <h4 className="mt-3 font-heading text-3xl text-foreground">{resume.fileName}</h4>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {resume.analysisSummary || "Resume analyzed and indexed for placement readiness."}
          </p>
        </div>

        <div className={`rounded-2xl border px-4 py-3 ${scoreTone(resume.score)}`}>
          <p className="text-xs uppercase tracking-[0.18em]">Score</p>
          <p className="mt-2 font-heading text-4xl">{resume.score}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-[1.1rem] border border-border/80 bg-background/45 p-4">
          <div className="flex items-center gap-2 text-foreground">
            <BadgeCheck className="h-4 w-4 text-emerald-300" />
            <p className="text-sm uppercase tracking-[0.16em] text-muted-foreground">Strengths</p>
          </div>
          <div className="mt-3 grid gap-2">
            {(resume.strengths.length ? resume.strengths : ["No strong signals were extracted yet."]).map((item) => (
              <div key={item} className="rounded-xl border border-border/80 bg-card/60 px-3 py-3 text-sm leading-6 text-foreground/85">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.1rem] border border-border/80 bg-background/45 p-4">
          <div className="flex items-center gap-2 text-foreground">
            <Target className="h-4 w-4 text-primary" />
            <p className="text-sm uppercase tracking-[0.16em] text-muted-foreground">Improvements</p>
          </div>
          <div className="mt-3 grid gap-2">
            {(resume.improvements.length ? resume.improvements : ["No critical gaps were detected."]).map((item) => (
              <div key={item} className="rounded-xl border border-border/80 bg-card/60 px-3 py-3 text-sm leading-6 text-foreground/85">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-[1.1rem] border border-border/80 bg-background/45 p-4">
        <p className="text-sm uppercase tracking-[0.16em] text-muted-foreground">Keyword alignment</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(resume.keywords.length ? resume.keywords : ["No role keywords matched yet."]).map((keyword) => (
            <span key={keyword} className="coach-chip border-primary/20 bg-primary/8 text-foreground/85">
              {keyword}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-[1.1rem] border border-border/80 bg-background/45 p-4">
        <p className="text-sm uppercase tracking-[0.16em] text-muted-foreground">Section coverage</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {sectionEntries.map(([label, active]) => (
            <SectionCoveragePill key={label} label={label} active={active} />
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
        <span>{formatBytes(resume.sizeBytes)}</span>
        <span>{resume.storageProvider || "storage"}</span>
        <span>{formatTimestamp(resume.createdAt)}</span>
        {resume.secureUrl && (
          <a
            href={resume.secureUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary transition hover:text-foreground"
          >
            Open uploaded file
          </a>
        )}
      </div>
    </div>
  );
}

export default function ResumeAnalysisPanel({
  defaultTargetRole = "",
}: {
  defaultTargetRole?: string;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [targetRole, setTargetRole] = useState(defaultTargetRole);
  const [jobDescription, setJobDescription] = useState("");

  const latestQuery = useQuery({
    queryKey: ["resume-analysis", "latest"],
    queryFn: fetchLatestResumeAnalysis,
  });
  const historyQuery = useQuery({
    queryKey: ["resume-analysis", "history"],
    queryFn: fetchResumeAnalysisHistory,
  });

  useQueryErrorLogger("ResumeAnalysisPanel:latest", latestQuery.error);
  useQueryErrorLogger("ResumeAnalysisPanel:history", historyQuery.error);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file && !resumeText.trim()) {
        throw new Error("Upload a resume or paste resume text before running analysis.");
      }

      return uploadResumeForAnalysis({
        file,
        resumeText: resumeText.trim() || undefined,
        targetRole: targetRole.trim() || undefined,
        jobDescription: jobDescription.trim() || undefined,
      });
    },
    onSuccess: async () => {
      setFile(null);
      setResumeText("");
      setJobDescription("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["resume-analysis", "latest"] }),
        queryClient.invalidateQueries({ queryKey: ["resume-analysis", "history"] }),
      ]);
      toast.success("Resume uploaded and analyzed.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to analyze resume.");
    },
  });

  return (
    <section className="surface-panel p-6 md:p-7">
      <div className="mb-6">
        <p className="section-label">Resume Review</p>
        <h3 className="mt-2 font-heading text-3xl text-foreground">Run your resume through the same system.</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Upload the file, paste the resume text for sharper analysis, and let PlacePrep score structure, keyword alignment,
          strengths, and interview-facing gaps.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.25fr]">
        <div className="rounded-[1.35rem] border border-border/80 bg-card/65 p-5">
          <div className="flex items-center gap-2 text-foreground">
            <UploadCloud className="h-4 w-4 text-primary" />
            <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Analyze resume</p>
          </div>

          <div className="mt-4 grid gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.doc,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
              className="hidden"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />

            <div className="flex min-h-14 items-center justify-between gap-3 rounded-[1.2rem] border border-border/80 bg-background/70 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">
                  {file?.name || "No file chosen"}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  PDF, DOCX, DOC, or TXT
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {file && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 px-3"
                    onClick={() => {
                      setFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                  >
                    Clear
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  className="h-10 gap-2 border-border/80 bg-card/60"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FolderUp className="h-4 w-4" />
                  {file ? "Replace file" : "Choose resume"}
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={targetRole}
                onChange={(event) => setTargetRole(event.target.value)}
                placeholder="Target role, for example Backend Engineer"
                className="h-11 border-border/80 bg-background/70"
              />
              <Input
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
                placeholder="Optional job description focus"
                className="h-11 border-border/80 bg-background/70"
              />
            </div>

            <Textarea
              value={resumeText}
              onChange={(event) => setResumeText(event.target.value)}
              placeholder="Paste the raw resume text here for deeper analysis, especially if you uploaded a PDF or DOCX."
              className="min-h-[180px] border-border/80 bg-background/70"
            />

            <div className="rounded-[1.1rem] border border-border/80 bg-background/45 p-4 text-sm leading-6 text-muted-foreground">
              PDF and DOCX files are stored normally, but pasted raw text gives the AI a much sharper read on sections,
              keyword alignment, and improvement points.
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                className="h-11 gap-2"
                onClick={() => uploadMutation.mutate()}
                disabled={uploadMutation.isPending}
              >
                {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {uploadMutation.isPending ? "Analyzing..." : "Upload and analyze"}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-11 gap-2 border-border/80 bg-background/70"
                onClick={() => {
                  setFile(null);
                  setResumeText("");
                  setJobDescription("");
                  setTargetRole(defaultTargetRole);
                }}
                disabled={uploadMutation.isPending}
              >
                Reset
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          {latestQuery.isPending && !latestQuery.data && (
            <PageStatusPanel
              eyebrow="Resume sync"
              title="Checking for the latest resume analysis."
              description="The panel is restoring your most recent review."
              loading
            />
          )}

          {latestQuery.isError && (
            <PageStatusPanel
              eyebrow="Resume fallback"
              title="Resume analysis could not be loaded."
              description="The upload panel still works. Retry the latest analysis feed whenever you want."
              actionLabel="Retry"
              onAction={() => void latestQuery.refetch()}
              tone="danger"
            />
          )}

          {!latestQuery.isPending && !latestQuery.isError && <ResumeInsightCard resume={latestQuery.data ?? null} />}
        </div>
      </div>

      <div className="mt-6 rounded-[1.35rem] border border-border/80 bg-card/65 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-foreground">
            <FileText className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Resume history</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Every upload stays visible so you can compare versions instead of overwriting your own progress.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-11 gap-2 border-border/80 bg-background/70"
            onClick={() => {
              void latestQuery.refetch();
              void historyQuery.refetch();
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="mt-4 grid gap-3">
          {historyQuery.isPending && (
            <div className="rounded-[1.1rem] border border-border/80 bg-background/45 px-4 py-4 text-sm text-muted-foreground">
              Loading resume analysis history.
            </div>
          )}

          {!historyQuery.isPending && !(historyQuery.data || []).length && (
            <div className="rounded-[1.1rem] border border-border/80 bg-background/45 px-4 py-4 text-sm text-muted-foreground">
              No resume versions have been analyzed yet.
            </div>
          )}

          {(historyQuery.data || []).map((resume) => (
            <article
              key={resume.id}
              className="rounded-[1.1rem] border border-border/80 bg-background/45 px-4 py-4"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base text-foreground">{resume.fileName}</p>
                    {resume.isActive && <span className="coach-chip border-primary/25">Active</span>}
                    <span className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.16em] ${scoreTone(resume.score)}`}>
                      {resume.score} score
                    </span>
                  </div>

                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                    {resume.analysisSummary || "Resume analyzed for structure and role fit."}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(resume.keywords || []).slice(0, 8).map((keyword) => (
                      <span key={keyword} className="coach-chip border-primary/20 bg-primary/8 text-foreground/85">
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="min-w-[200px] space-y-2 text-sm text-muted-foreground md:text-right">
                  <div className="inline-flex items-center gap-2 md:ml-auto">
                    <BriefcaseBusiness className="h-4 w-4" />
                    {formatBytes(resume.sizeBytes)}
                  </div>
                  <p>{formatTimestamp(resume.createdAt)}</p>
                  {resume.secureUrl && (
                    <a
                      href={resume.secureUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-primary transition hover:text-foreground"
                    >
                      Open file
                    </a>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
