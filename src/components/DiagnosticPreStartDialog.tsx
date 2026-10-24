import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Clock,
  Target,
  ShieldCheck,
  Brain,
  Code2,
  BookOpen,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  PendingBaselineSummary,
  AssessmentSession,
  startAssessmentSession,
} from "@/lib/api";
import { toast } from "sonner";

interface DiagnosticPreStartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingBaseline: PendingBaselineSummary | null;
  onActivated?: (session: AssessmentSession) => void;
}

export function DiagnosticPreStartDialog({
  open,
  onOpenChange,
  pendingBaseline,
  onActivated,
}: DiagnosticPreStartDialogProps) {
  const [isStarting, setIsStarting] = useState(false);

  if (!pendingBaseline) return null;

  const role = pendingBaseline.targetRole || "Software Development Engineer";
  const company = pendingBaseline.companyName || "Target Company";
  const seniority = pendingBaseline.seniority || "Mid-Level";
  const duration = pendingBaseline.durationMinutes || 20;
  const isGeneral = Boolean(pendingBaseline.isGeneralGuidance);
  const guidanceLabel =
    pendingBaseline.guidanceClassification ||
    (isGeneral
      ? "General Role Guidance (Unverified Company Specifics)"
      : `${company}-aligned preparation based on public sources`);

  const sections = pendingBaseline.sections || [
    {
      id: "A",
      title: "Section A: Conceptual Competencies",
      type: "mcq",
      questionCount: 4,
      timeMinutes: 10,
    },
    {
      id: "B",
      title: "Section B: Algorithmic Implementation",
      type: "coding",
      questionCount: 1,
      timeMinutes: 10,
    },
  ];

  const handleStart = async () => {
    if (!pendingBaseline.id) {
      toast.error("Diagnostic assessment identifier not found.");
      return;
    }

    setIsStarting(true);
    try {
      const response = await startAssessmentSession(pendingBaseline.id);
      toast.success("Diagnostic session activated. Timer started.");
      onOpenChange(false);
      if (onActivated && response?.data) {
        onActivated(response.data);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to activate diagnostic session."
      );
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-border/80 bg-[#121215] text-[#F3EBDD] p-6 sm:p-7 shadow-2xl">
        <DialogHeader className="space-y-2 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Baseline Diagnostic
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-[#A1A1AA]">
              <Clock className="h-3 w-3" />
              {duration} Minutes Timed
            </span>
          </div>

          <DialogTitle className="font-heading text-2xl sm:text-3xl tracking-tight text-[#F3EBDD]">
            Begin Technical Diagnostic
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-[#A1A1AA]">
            Benchmark your core competencies for <span className="font-medium text-[#F3EBDD]">{role}</span> at{" "}
            <span className="font-medium text-[#F3EBDD]">{company}</span> ({seniority}).
          </DialogDescription>
        </DialogHeader>

        {/* Guidance provenance badge */}
        <div
          className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs leading-relaxed ${
            isGeneral
              ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
              : "border-sky-500/30 bg-sky-500/10 text-sky-300"
          }`}
        >
          {isGeneral ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div>
            <span className="font-semibold">{guidanceLabel}</span>
            <p className="mt-0.5 text-white/70">
              {isGeneral
                ? "Company specifics could not be independently verified. Questions reflect industry-standard competencies for this seniority tier."
                : "Exercises are practice questions synthesized from public hiring rubrics, technical documentation, and community candidate reports. They are not official employer interview questions."}
            </p>
          </div>
        </div>

        {/* Section Breakdown */}
        <div className="space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#71717A]">
            Diagnostic Structure (2 Distinct Sections)
          </p>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 transition hover:border-white/15">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20 text-primary">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#F3EBDD]">Section A: Conceptual</p>
                  <p className="text-[11px] text-[#A1A1AA]">4 MCQs • ~10 minutes</p>
                </div>
              </div>
              <p className="mt-2 text-xs leading-snug text-[#A1A1AA]">
                Systems architecture, memory models, runtime mechanics, and algorithmic invariants.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 transition hover:border-white/15">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Code2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#F3EBDD]">Section B: Practical Coding</p>
                  <p className="text-[11px] text-[#A1A1AA]">1 Problem • ~10 minutes</p>
                </div>
              </div>
              <p className="mt-2 text-xs leading-snug text-[#A1A1AA]">
                Grounded in community-reported LeetCode candidate problems with exact complexity verification.
              </p>
            </div>
          </div>
        </div>

        {/* Diagnostic rules and safety guarantee */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 text-xs text-[#A1A1AA] space-y-1.5">
          <div className="flex items-center gap-2 text-[#F3EBDD] font-medium">
            <Brain className="h-4 w-4 text-primary" />
            <span>Calibration &amp; Progress Safety Rules</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-white/70 pl-1">
            <li>
              Timer begins strictly upon clicking <strong className="text-white">Begin Diagnostic</strong>.
            </li>
            <li>Identifies skill gaps to calibrate Weeks 1 &amp; 2 focus topics and daily tasks.</li>
            <li>
              <strong className="text-emerald-400">User Progress Protected:</strong> All prior completed tasks,
              streaks, and study history will be preserved without modification.
            </li>
          </ul>
        </div>

        <DialogFooter className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            className="border border-white/10 bg-transparent text-[#A1A1AA] hover:bg-white/5 hover:text-[#F3EBDD]"
            onClick={() => onOpenChange(false)}
            disabled={isStarting}
          >
            Cancel
          </Button>

          <Button
            type="button"
            className="h-11 gap-2 bg-primary px-6 font-semibold text-primary-foreground shadow-lg hover:bg-primary/90"
            onClick={handleStart}
            disabled={isStarting}
          >
            {isStarting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Activating Diagnostic...
              </>
            ) : (
              <>
                Begin Diagnostic
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
