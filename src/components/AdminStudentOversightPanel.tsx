import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Brain,
  Camera,
  Clock3,
  Loader2,
  ShieldCheck,
  Sigma,
  UserRoundSearch,
} from "lucide-react";
import { toast } from "sonner";

import PageStatusPanel from "@/components/PageStatusPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQueryErrorLogger } from "@/hooks/use-query-error-logger";
import {
  createPracticeCapsule,
  fetchCoachStudents,
  type PracticeCapsule,
  type StudentOversightRecord,
} from "@/lib/api";

function formatShortDate(value?: string | null) {
  if (!value) {
    return "Not tracked yet";
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

function formatSignedProgress(value?: number | null, suffix = "%") {
  return `${Math.round(Number(value || 0))}${suffix}`;
}

function formatHours(value?: number | null) {
  return `${Number(value || 0).toFixed(1)}h`;
}

function OversightMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="metric-panel rounded-[1.2rem] px-4 py-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-heading text-3xl text-foreground">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{helper}</p>
    </div>
  );
}

function PracticeCapsuleCard({ capsule }: { capsule: PracticeCapsule }) {
  const completedCount = capsule.items.filter((item) => item.status === "completed").length;

  return (
    <article className="rounded-[1.2rem] border border-border/80 bg-background/45 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-base text-foreground">{capsule.title}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {completedCount}/{capsule.items.length} cleared
            {capsule.assignedByName ? ` / shared by ${capsule.assignedByName}` : ""}
          </p>
          {capsule.note && (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{capsule.note}</p>
          )}
        </div>

        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
          {formatShortDate(capsule.scheduledFor)}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {capsule.items.map((item) => (
          <div
            key={item.taskId}
            className="rounded-[1rem] border border-border/80 bg-card/60 px-4 py-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-foreground">{item.title}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {item.category} / {item.capsuleType.replace(/_/g, " ")}
                </p>
              </div>

              <span
                className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${
                  item.status === "completed"
                    ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                    : item.status === "in_progress"
                      ? "border-primary/20 bg-primary/10 text-primary"
                      : "border-border/80 bg-background/60 text-muted-foreground"
                }`}
              >
                {item.status.replace(/_/g, " ")}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="truncate text-xs text-muted-foreground">
                {item.referenceLabel || "Open practice link"}
              </p>
              {item.referenceUrl && (
                <a
                  href={item.referenceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary transition hover:text-foreground"
                >
                  Open
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function RecentProofCard({
  image,
}: {
  image: StudentOversightRecord["recentProofs"][number];
}) {
  return (
    <a
      href={image.secureUrl}
      target="_blank"
      rel="noreferrer"
      className="group overflow-hidden rounded-[1rem] border border-border/80 bg-background/50 transition hover:border-primary/30"
    >
      <div className="aspect-[5/4] overflow-hidden bg-black/20">
        <img
          src={image.secureUrl}
          alt={image.caption || "Student proof upload"}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      </div>
      <div className="space-y-2 px-3 py-3">
        <p className="line-clamp-2 text-sm text-foreground">
          {image.caption || "Proof of completed work"}
        </p>
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {formatShortDate(image.proofDate || image.createdAt)}
        </p>
      </div>
    </a>
  );
}

export default function AdminStudentOversightPanel() {
  const queryClient = useQueryClient();
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [leetcodeOneUrl, setLeetcodeOneUrl] = useState("");
  const [leetcodeTwoUrl, setLeetcodeTwoUrl] = useState("");
  const [verbalUrl, setVerbalUrl] = useState("");
  const [aptitudeUrl, setAptitudeUrl] = useState("");
  const [leetcodeOneLabel, setLeetcodeOneLabel] = useState("");
  const [leetcodeTwoLabel, setLeetcodeTwoLabel] = useState("");
  const [verbalLabel, setVerbalLabel] = useState("");
  const [aptitudeLabel, setAptitudeLabel] = useState("");

  const studentsQuery = useQuery({
    queryKey: ["coach", "students"],
    queryFn: fetchCoachStudents,
  });

  useQueryErrorLogger("AdminStudentOversightPanel:students", studentsQuery.error);

  useEffect(() => {
    const firstStudentId = studentsQuery.data?.[0]?.student.id || "";

    if (!firstStudentId) {
      setSelectedStudentId("");
      return;
    }

    const stillExists = (studentsQuery.data || []).some((entry) => entry.student.id === selectedStudentId);
    if (!selectedStudentId || !stillExists) {
      setSelectedStudentId(firstStudentId);
    }
  }, [selectedStudentId, studentsQuery.data]);

  const selectedStudent = useMemo(
    () => (studentsQuery.data || []).find((entry) => entry.student.id === selectedStudentId) || null,
    [selectedStudentId, studentsQuery.data],
  );

  const createCapsuleMutation = useMutation({
    mutationFn: () => {
      if (!selectedStudentId) {
        throw new Error("Choose a student before assigning a capsule.");
      }

      return createPracticeCapsule({
        studentUserId: selectedStudentId,
        title: title.trim() || undefined,
        note: note.trim() || undefined,
        scheduledFor: scheduledFor || undefined,
        leetcodeOneUrl: leetcodeOneUrl.trim(),
        leetcodeTwoUrl: leetcodeTwoUrl.trim(),
        verbalUrl: verbalUrl.trim(),
        aptitudeUrl: aptitudeUrl.trim(),
        leetcodeOneLabel: leetcodeOneLabel.trim() || undefined,
        leetcodeTwoLabel: leetcodeTwoLabel.trim() || undefined,
        verbalLabel: verbalLabel.trim() || undefined,
        aptitudeLabel: aptitudeLabel.trim() || undefined,
      });
    },
    onSuccess: async () => {
      setTitle("");
      setNote("");
      setScheduledFor("");
      setLeetcodeOneUrl("");
      setLeetcodeTwoUrl("");
      setVerbalUrl("");
      setAptitudeUrl("");
      setLeetcodeOneLabel("");
      setLeetcodeTwoLabel("");
      setVerbalLabel("");
      setAptitudeLabel("");
      await queryClient.invalidateQueries({ queryKey: ["coach", "students"] });
      toast.success("Practice capsule assigned to the student.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to assign practice capsule.");
    },
  });

  return (
    <section className="surface-panel p-6 md:p-7">
      <div className="mb-6">
        <p className="section-label">Admin oversight</p>
        <h3 className="mt-2 font-heading text-3xl text-foreground">
          Watch the students you let into the system.
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          All admins can inspect student momentum, latest proof uploads, and push a fresh practice capsule with two LeetCode links plus verbal and aptitude drills.
        </p>
      </div>

      {studentsQuery.isPending && !studentsQuery.data && (
        <PageStatusPanel
          eyebrow="Coaching sync"
          title="Loading invited students."
          description="PlacePrep is restoring student progress snapshots, proof uploads, and assigned practice capsules."
          loading
        />
      )}

      {studentsQuery.isError && (
        <PageStatusPanel
          eyebrow="Coaching fallback"
          title="Student oversight could not be loaded."
          description="Retry to bring the latest student telemetry and practice links back into view."
          actionLabel="Retry"
          onAction={() => void studentsQuery.refetch()}
          tone="danger"
        />
      )}

      {!studentsQuery.isPending && !studentsQuery.isError && !(studentsQuery.data || []).length && (
        <div className="rounded-[1.35rem] border border-border/80 bg-card/60 p-5">
          <div className="flex items-center gap-3 text-foreground">
            <UserRoundSearch className="h-5 w-5 text-primary" />
            <p className="text-base">No invited students yet.</p>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Once a user joins through an invite, every admin will be able to see their latest progress signal, uploaded proof shots, and admin-assigned practice capsules here.
          </p>
        </div>
      )}

      {!!selectedStudent && (
        <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
          <div className="space-y-4">
            <div className="rounded-[1.35rem] border border-border/80 bg-card/60 p-5">
              <div className="flex items-center gap-2 text-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Student roster</p>
              </div>

              <div className="mt-4 grid gap-3">
                {(studentsQuery.data || []).map((entry) => {
                  const isActive = entry.student.id === selectedStudentId;

                  return (
                    <button
                      key={entry.student.id}
                      type="button"
                      onClick={() => setSelectedStudentId(entry.student.id)}
                      className={`rounded-[1.2rem] border px-4 py-4 text-left transition ${
                        isActive
                          ? "border-primary/35 bg-primary/10 shadow-[0_0_26px_hsl(0_55%_33%_/_0.08)]"
                          : "border-border/80 bg-background/45 hover:border-border hover:bg-background/60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base text-foreground">{entry.student.name}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                            @{entry.student.username || "user"} / {entry.student.targetRole || "student"}
                          </p>
                        </div>
                        <span className="coach-chip border-primary/20 bg-background/50">
                          {formatSignedProgress(entry.progress.readinessScore)}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        Invited by {entry.invitedBy.name || "system"} / {entry.taskSummary.completed} completed / {entry.taskSummary.pending} pending
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[1.35rem] border border-border/80 bg-card/60 p-5">
              <div className="flex items-center gap-2 text-foreground">
                <BookOpen className="h-4 w-4 text-primary" />
                <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Assign practice capsule</p>
              </div>

              <div className="mt-4 grid gap-3">
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Bundle title, for example Weekend pressure set"
                  className="h-11 border-border/80 bg-background/70"
                />

                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Optional note to frame the assignment, expectations, or why this set matters."
                  className="min-h-[96px] border-border/80 bg-background/70"
                />

                <Input
                  type="date"
                  value={scheduledFor}
                  onChange={(event) => setScheduledFor(event.target.value)}
                  className="h-11 border-border/80 bg-background/70"
                />

                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    value={leetcodeOneLabel}
                    onChange={(event) => setLeetcodeOneLabel(event.target.value)}
                    placeholder="LeetCode label 1"
                    className="h-11 border-border/80 bg-background/70"
                  />
                  <Input
                    value={leetcodeOneUrl}
                    onChange={(event) => setLeetcodeOneUrl(event.target.value)}
                    placeholder="https://leetcode.com/problems/..."
                    className="h-11 border-border/80 bg-background/70"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    value={leetcodeTwoLabel}
                    onChange={(event) => setLeetcodeTwoLabel(event.target.value)}
                    placeholder="LeetCode label 2"
                    className="h-11 border-border/80 bg-background/70"
                  />
                  <Input
                    value={leetcodeTwoUrl}
                    onChange={(event) => setLeetcodeTwoUrl(event.target.value)}
                    placeholder="https://leetcode.com/problems/..."
                    className="h-11 border-border/80 bg-background/70"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    value={verbalLabel}
                    onChange={(event) => setVerbalLabel(event.target.value)}
                    placeholder="Verbal label"
                    className="h-11 border-border/80 bg-background/70"
                  />
                  <Input
                    value={verbalUrl}
                    onChange={(event) => setVerbalUrl(event.target.value)}
                    placeholder="https://..."
                    className="h-11 border-border/80 bg-background/70"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    value={aptitudeLabel}
                    onChange={(event) => setAptitudeLabel(event.target.value)}
                    placeholder="Aptitude label"
                    className="h-11 border-border/80 bg-background/70"
                  />
                  <Input
                    value={aptitudeUrl}
                    onChange={(event) => setAptitudeUrl(event.target.value)}
                    placeholder="https://..."
                    className="h-11 border-border/80 bg-background/70"
                  />
                </div>

                <Button
                  type="button"
                  className="h-11 gap-2"
                  onClick={() => createCapsuleMutation.mutate()}
                  disabled={createCapsuleMutation.isPending}
                >
                  {createCapsuleMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4" />
                  )}
                  {createCapsuleMutation.isPending ? "Assigning..." : "Share practice capsule"}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.35rem] border border-border/80 bg-card/60 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Selected student</p>
                  <h4 className="mt-3 font-heading text-4xl text-foreground">{selectedStudent.student.name}</h4>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    @{selectedStudent.student.username || "user"} / {selectedStudent.student.email}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Invited by {selectedStudent.invitedBy.name || "system"} via {selectedStudent.invitedBy.inviteCode || "manual invite"} on{" "}
                    {formatShortDate(selectedStudent.invitedBy.invitedAt)}
                  </p>
                </div>

                <div className="coach-chip border-primary/25 bg-primary/10 text-foreground">
                  {selectedStudent.student.targetRole || "Placement prep"}
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <OversightMetric
                  label="Streak"
                  value={`${selectedStudent.progress.streak}d`}
                  helper="Recent activity streak."
                />
                <OversightMetric
                  label="Consistency"
                  value={formatSignedProgress(selectedStudent.progress.consistencyScore)}
                  helper="Last synced discipline score."
                />
                <OversightMetric
                  label="Readiness"
                  value={formatSignedProgress(selectedStudent.progress.readinessScore)}
                  helper="Current placement signal."
                />
                <OversightMetric
                  label="Hours"
                  value={formatHours(selectedStudent.progress.totalHours)}
                  helper="Latest logged study time."
                />
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-[1.1rem] border border-border/80 bg-background/45 p-4">
                  <div className="flex items-center gap-2 text-foreground">
                    <Activity className="h-4 w-4 text-primary" />
                    <p className="text-sm uppercase tracking-[0.16em] text-muted-foreground">Task board</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-foreground/85">
                    {selectedStudent.taskSummary.completed} completed / {selectedStudent.taskSummary.pending} pending / {selectedStudent.taskSummary.overdue} overdue
                  </p>
                </div>

                <div className="rounded-[1.1rem] border border-border/80 bg-background/45 p-4">
                  <div className="flex items-center gap-2 text-foreground">
                    <Clock3 className="h-4 w-4 text-primary" />
                    <p className="text-sm uppercase tracking-[0.16em] text-muted-foreground">Last snapshot</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-foreground/85">
                    {formatShortDate(selectedStudent.progress.statDate)}
                  </p>
                </div>

                <div className="rounded-[1.1rem] border border-border/80 bg-background/45 p-4">
                  <div className="flex items-center gap-2 text-foreground">
                    <Brain className="h-4 w-4 text-primary" />
                    <p className="text-sm uppercase tracking-[0.16em] text-muted-foreground">Weak areas</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(selectedStudent.student.weakAreas?.length
                      ? selectedStudent.student.weakAreas.slice(0, 4)
                      : ["No weak areas stored"]).map((topic) => (
                      <span key={topic} className="coach-chip border-border/80 bg-card/60 text-foreground/80">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.35rem] border border-border/80 bg-card/60 p-5">
              <div className="flex items-center gap-2 text-foreground">
                <Camera className="h-4 w-4 text-primary" />
                <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Recent proof uploads</p>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {selectedStudent.recentProofs.length ? (
                  selectedStudent.recentProofs.map((image) => (
                    <RecentProofCard key={image.id} image={image} />
                  ))
                ) : (
                  <div className="md:col-span-2 xl:col-span-4 rounded-[1.1rem] border border-border/80 bg-background/45 px-4 py-4 text-sm text-muted-foreground">
                    No proof uploads yet from this student.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[1.35rem] border border-border/80 bg-card/60 p-5">
              <div className="flex items-center gap-2 text-foreground">
                <Sigma className="h-4 w-4 text-primary" />
                <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Recent practice capsules</p>
              </div>

              <div className="mt-4 grid gap-3">
                {selectedStudent.practiceCapsules.length ? (
                  selectedStudent.practiceCapsules.map((capsule) => (
                    <PracticeCapsuleCard key={capsule.bundleId} capsule={capsule} />
                  ))
                ) : (
                  <div className="rounded-[1.1rem] border border-border/80 bg-background/45 px-4 py-4 text-sm text-muted-foreground">
                    No admin practice capsules have been assigned yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
