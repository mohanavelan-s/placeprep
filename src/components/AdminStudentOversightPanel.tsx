import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Brain,
  Camera,
  Clock3,
  Layers3,
  Loader2,
  Plus,
  ShieldCheck,
  Sigma,
  UserPlus,
  UserRoundSearch,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import PageStatusPanel from "@/components/PageStatusPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQueryErrorLogger } from "@/hooks/use-query-error-logger";
import {
  addCoachGroupMembers,
  createCoachGroup,
  createPracticeCapsule,
  fetchCoachGroups,
  fetchCoachStudents,
  type CoachGroup,
  type PracticeCapsule,
  type PracticeCapsuleDispatchResult,
  type StudentOversightRecord,
  removeCoachGroupMember,
} from "@/lib/api";

function formatShortDate(value?: string | null) {
  if (!value) {
    return "Not tracked yet";
  }

  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }

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

function buildAssignmentSuccessMessage(result: PracticeCapsuleDispatchResult) {
  const recipientsLabel = `${result.recipientsCount} student${result.recipientsCount === 1 ? "" : "s"}`;
  const targetLabel =
    result.targetLabel || (result.targetKind === "group" ? "selected group" : "selected student");

  return `Assignment bundle shared to ${recipientsLabel} via ${targetLabel}.`;
}

type AssignmentItemDraft = {
  id: string;
  title: string;
  referenceUrl: string;
  type: string;
};

function createDraftId() {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createAssignmentItemDraft(partial: Partial<AssignmentItemDraft> = {}): AssignmentItemDraft {
  return {
    id: partial.id || createDraftId(),
    title: partial.title || "",
    referenceUrl: partial.referenceUrl || "",
    type: partial.type || "custom",
  };
}

function createDefaultAssignmentItems() {
  return [
    createAssignmentItemDraft({
      title: "LeetCode Drill 1",
      type: "leetcode_one",
    }),
    createAssignmentItemDraft({
      title: "LeetCode Drill 2",
      type: "leetcode_two",
    }),
    createAssignmentItemDraft({
      title: "Verbal Reasoning Drill",
      referenceLabel: "Verbal practice",
      type: "verbal",
    }),
    createAssignmentItemDraft({
      title: "Aptitude Drill",
      referenceLabel: "Aptitude practice",
      type: "aptitude",
    }),
  ];
}

function toLocalDateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toLocalTimeInputValue(value: Date) {
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function buildDefaultDeadlineDraft() {
  const nextMorning = new Date();
  nextMorning.setDate(nextMorning.getDate() + 1);
  nextMorning.setHours(9, 0, 0, 0);

  return {
    deadlineDate: toLocalDateInputValue(nextMorning),
    deadlineTime: toLocalTimeInputValue(nextMorning),
  };
}

function buildAssignmentItemPayload(item: AssignmentItemDraft) {
  const title = item.title.trim();
  const referenceUrl = item.referenceUrl.trim();

  if (!title && !referenceUrl) {
    return null;
  }

  if (item.type === "leetcode_one" || item.type === "leetcode_two") {
    const resolvedTitle = title || "LeetCode Drill";
    return {
      title: resolvedTitle,
      category: "DSA",
      subcategory: "Admin capsule",
      referenceLabel: resolvedTitle,
      referenceUrl: referenceUrl || undefined,
      estimatedMinutes: 45,
      difficulty: 3,
      weakArea: "DSA",
      type: item.type,
    };
  }

  if (item.type === "verbal") {
    const resolvedTitle = title || "Verbal Reasoning Drill";
    return {
      title: resolvedTitle,
      category: "Other",
      subcategory: "Verbal",
      referenceLabel: resolvedTitle,
      referenceUrl: referenceUrl || undefined,
      estimatedMinutes: 30,
      difficulty: 2,
      weakArea: "Verbal",
      type: item.type,
    };
  }

  if (item.type === "aptitude") {
    const resolvedTitle = title || "Aptitude Drill";
    return {
      title: resolvedTitle,
      category: "Aptitude",
      subcategory: "Admin capsule",
      referenceLabel: resolvedTitle,
      referenceUrl: referenceUrl || undefined,
      estimatedMinutes: 30,
      difficulty: 2,
      weakArea: "Aptitude",
      type: item.type,
    };
  }

  const resolvedTitle = title || "Custom admin task";
  return {
    title: resolvedTitle,
    category: "Other",
    subcategory: "Admin assignment",
    referenceLabel: resolvedTitle,
    referenceUrl: referenceUrl || undefined,
    estimatedMinutes: 30,
    difficulty: 3,
    type: "custom",
  };
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
          Due {formatShortDate(capsule.dueAt || capsule.scheduledFor)}
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
                {item.referenceLabel || item.title || "Open the assigned task and complete it."}
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
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [targetType, setTargetType] = useState<"student" | "group">("student");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [deadlineDate, setDeadlineDate] = useState(() => buildDefaultDeadlineDraft().deadlineDate);
  const [deadlineTime, setDeadlineTime] = useState(() => buildDefaultDeadlineDraft().deadlineTime);
  const [assignmentItems, setAssignmentItems] = useState<AssignmentItemDraft[]>(() =>
    createDefaultAssignmentItems(),
  );
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [draftGroupMemberIds, setDraftGroupMemberIds] = useState<string[]>([]);

  const studentsQuery = useQuery({
    queryKey: ["coach", "students"],
    queryFn: fetchCoachStudents,
  });
  const groupsQuery = useQuery({
    queryKey: ["coach", "groups"],
    queryFn: fetchCoachGroups,
  });

  useQueryErrorLogger("AdminStudentOversightPanel:students", studentsQuery.error);
  useQueryErrorLogger("AdminStudentOversightPanel:groups", groupsQuery.error);

  const students = studentsQuery.data || [];
  const groups = groupsQuery.data || [];

  useEffect(() => {
    const firstStudentId = students[0]?.student.id || "";

    if (!firstStudentId) {
      setSelectedStudentId("");
      return;
    }

    const stillExists = students.some((entry) => entry.student.id === selectedStudentId);
    if (!selectedStudentId || !stillExists) {
      setSelectedStudentId(firstStudentId);
    }
  }, [selectedStudentId, students]);

  useEffect(() => {
    if (!groups.length) {
      setSelectedGroupId("");
      if (targetType === "group") {
        setTargetType("student");
      }
      return;
    }

    const stillExists = groups.some((group) => group.id === selectedGroupId);
    if (!selectedGroupId || !stillExists) {
      setSelectedGroupId(groups[0].id);
    }
  }, [groups, selectedGroupId, targetType]);

  const selectedStudent = useMemo(
    () => students.find((entry) => entry.student.id === selectedStudentId) || null,
    [selectedStudentId, students],
  );
  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) || null,
    [groups, selectedGroupId],
  );
  const selectedGroupMemberIds = useMemo(
    () => new Set((selectedGroup?.members || []).map((member) => member.userId)),
    [selectedGroup],
  );
  const availableStudentsForSelectedGroup = useMemo(
    () => students.filter((entry) => !selectedGroupMemberIds.has(entry.student.id)),
    [selectedGroupMemberIds, students],
  );
  const draftGroupStudents = useMemo(
    () => students.filter((entry) => draftGroupMemberIds.includes(entry.student.id)),
    [draftGroupMemberIds, students],
  );

  function resetCapsuleForm() {
    const nextDefaultDeadline = buildDefaultDeadlineDraft();
    setTitle("");
    setNote("");
    setDeadlineDate(nextDefaultDeadline.deadlineDate);
    setDeadlineTime(nextDefaultDeadline.deadlineTime);
    setAssignmentItems(createDefaultAssignmentItems());
  }

  function toggleDraftStudent(studentId: string) {
    setDraftGroupMemberIds((current) =>
      current.includes(studentId)
        ? current.filter((value) => value !== studentId)
        : [...current, studentId],
    );
  }

  function updateAssignmentItem(
    itemId: string,
    field: "title" | "referenceUrl",
    value: string,
  ) {
    setAssignmentItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)),
    );
  }

  function addAssignmentItem() {
    setAssignmentItems((current) => [...current, createAssignmentItemDraft()]);
  }

  function removeAssignmentItem(itemId: string) {
    setAssignmentItems((current) =>
      current.length <= 1 ? current : current.filter((item) => item.id !== itemId),
    );
  }

  const createGroupMutation = useMutation({
    mutationFn: () => {
      if (!groupName.trim()) {
        throw new Error("Give the group a name first.");
      }

      return createCoachGroup({
        name: groupName.trim(),
        description: groupDescription.trim() || undefined,
        studentUserIds: draftGroupMemberIds,
      });
    },
    onSuccess: async (group: CoachGroup) => {
      setGroupName("");
      setGroupDescription("");
      setDraftGroupMemberIds([]);
      setSelectedGroupId(group.id);
      setTargetType("group");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["coach", "groups"] }),
        queryClient.invalidateQueries({ queryKey: ["coach", "students"] }),
      ]);
      toast.success(`Group ${group.name} created.`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to create coach group.");
    },
  });

  const addGroupMembersMutation = useMutation({
    mutationFn: (studentUserIds: string[]) => {
      if (!selectedGroupId) {
        throw new Error("Choose a group before adding students.");
      }

      return addCoachGroupMembers(selectedGroupId, studentUserIds);
    },
    onSuccess: async (group: CoachGroup) => {
      setSelectedGroupId(group.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["coach", "groups"] }),
        queryClient.invalidateQueries({ queryKey: ["coach", "students"] }),
      ]);
      toast.success(`Students added to ${group.name}.`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to add students to the group.");
    },
  });

  const removeGroupMemberMutation = useMutation({
    mutationFn: ({ groupId, studentUserId }: { groupId: string; studentUserId: string }) =>
      removeCoachGroupMember(groupId, studentUserId),
    onSuccess: async (group: CoachGroup) => {
      setSelectedGroupId(group.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["coach", "groups"] }),
        queryClient.invalidateQueries({ queryKey: ["coach", "students"] }),
      ]);
      toast.success(`Student removed from ${group.name}.`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to remove the student from this group.");
    },
  });

  const createCapsuleMutation = useMutation({
    mutationFn: () => {
      if (targetType === "student" && !selectedStudentId) {
        throw new Error("Choose a student before sharing a capsule.");
      }
      if (targetType === "group" && !selectedGroupId) {
        throw new Error("Choose a group before sharing a capsule.");
      }

      const items = assignmentItems
        .map(buildAssignmentItemPayload)
        .filter((item): item is NonNullable<ReturnType<typeof buildAssignmentItemPayload>> => Boolean(item));

      if (!items.length) {
        throw new Error("Add at least one task before assigning.");
      }

      const normalizedDeadlineTime = deadlineTime || "09:00";

      return createPracticeCapsule({
        studentUserId: targetType === "student" ? selectedStudentId : undefined,
        groupId: targetType === "group" ? selectedGroupId : undefined,
        title: title.trim() || undefined,
        note: note.trim() || undefined,
        deadlineAt: deadlineDate ? `${deadlineDate}T${normalizedDeadlineTime}` : undefined,
        items,
      });
    },
    onSuccess: async (result) => {
      resetCapsuleForm();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["coach", "students"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications", "recent"] }),
      ]);
      toast.success(buildAssignmentSuccessMessage(result));
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
          All admins can inspect student momentum, latest proof uploads, build named groups, and assign deadline-aware task bundles to one student or an entire cohort.
        </p>
      </div>

      {((studentsQuery.isPending && !students.length) || (groupsQuery.isPending && !groups.length)) && (
        <PageStatusPanel
          eyebrow="Coaching sync"
          title="Loading invited students and groups."
          description="PlacePrep is restoring student progress snapshots, proof uploads, coaching groups, and assigned practice capsules."
          loading
        />
      )}

      {(studentsQuery.isError || groupsQuery.isError) && (
        <PageStatusPanel
          eyebrow="Coaching fallback"
          title="Student oversight could not be fully loaded."
          description="Retry to bring the latest student telemetry, group membership, and practice links back into view."
          actionLabel="Retry"
          onAction={() => {
            void studentsQuery.refetch();
            void groupsQuery.refetch();
          }}
          tone="danger"
        />
      )}

      {!studentsQuery.isPending && !studentsQuery.isError && !students.length && (
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
                {students.map((entry) => {
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
                <Users className="h-4 w-4 text-primary" />
                <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Coach groups</p>
              </div>

              <div className="mt-4 grid gap-3">
                {groups.length ? (
                  groups.map((group) => {
                    const isActive = group.id === selectedGroupId;

                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => {
                          setSelectedGroupId(group.id);
                          setTargetType("group");
                        }}
                        className={`rounded-[1.2rem] border px-4 py-4 text-left transition ${
                          isActive
                            ? "border-primary/35 bg-primary/10 shadow-[0_0_26px_hsl(0_55%_33%_/_0.08)]"
                            : "border-border/80 bg-background/45 hover:border-border hover:bg-background/60"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base text-foreground">{group.name}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                              {group.memberCount} member{group.memberCount === 1 ? "" : "s"}
                            </p>
                          </div>
                          <span className="coach-chip border-primary/20 bg-background/50">
                            {group.memberCount}
                          </span>
                        </div>
                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
                          {group.description || "No description yet. Use this group to dispatch shared drills faster."}
                        </p>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-[1.1rem] border border-border/80 bg-background/45 px-4 py-4 text-sm text-muted-foreground">
                    No groups yet. Create one below to cluster students by batch, topic, or cohort.
                  </div>
                )}
              </div>

              {selectedGroup && (
                <div className="mt-4 rounded-[1.2rem] border border-border/80 bg-background/45 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base text-foreground">{selectedGroup.name}</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {selectedGroup.description || "No description for this group yet."}
                      </p>
                    </div>
                    <span className="coach-chip border-primary/20 bg-card/60">
                      {selectedGroup.memberCount} members
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedGroup.members.length ? (
                      selectedGroup.members.map((member) => (
                        <div
                          key={member.userId}
                          className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/60 px-3 py-2 text-sm text-foreground"
                        >
                          <span>{member.name}</span>
                          <button
                            type="button"
                            className="rounded-full p-1 text-muted-foreground transition hover:bg-background/80 hover:text-foreground"
                            onClick={() =>
                              removeGroupMemberMutation.mutate({
                                groupId: selectedGroup.id,
                                studentUserId: member.userId,
                              })
                            }
                            disabled={removeGroupMemberMutation.isPending}
                            aria-label={`Remove ${member.name} from ${selectedGroup.name}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm leading-6 text-muted-foreground">
                        No students in this group yet.
                      </p>
                    )}
                  </div>

                  <div className="mt-4 border-t border-border/70 pt-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Add students to this group
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {availableStudentsForSelectedGroup.length ? (
                        availableStudentsForSelectedGroup.map((entry) => (
                          <Button
                            key={entry.student.id}
                            type="button"
                            variant="outline"
                            className="h-9 gap-2 border-border/80 bg-card/60"
                            disabled={addGroupMembersMutation.isPending}
                            onClick={() => addGroupMembersMutation.mutate([entry.student.id])}
                          >
                            <UserPlus className="h-4 w-4" />
                            {entry.student.name}
                          </Button>
                        ))
                      ) : (
                        <p className="text-sm leading-6 text-muted-foreground">
                          Everyone in the roster is already part of this group.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 rounded-[1.2rem] border border-border/80 bg-background/45 p-4">
                <div className="flex items-center gap-2 text-foreground">
                  <Layers3 className="h-4 w-4 text-primary" />
                  <p className="text-sm uppercase tracking-[0.16em] text-muted-foreground">Create new group</p>
                </div>

                <div className="mt-4 grid gap-3">
                  <Input
                    value={groupName}
                    onChange={(event) => setGroupName(event.target.value)}
                    placeholder="Group name, for example Backend cohort"
                    className="h-11 border-border/80 bg-card/60"
                  />

                  <Textarea
                    value={groupDescription}
                    onChange={(event) => setGroupDescription(event.target.value)}
                    placeholder="Optional description so other admins know what this group is for."
                    className="min-h-[92px] border-border/80 bg-card/60"
                  />

                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Add initial students
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {students.length ? (
                        students.map((entry) => {
                          const isSelected = draftGroupMemberIds.includes(entry.student.id);

                          return (
                            <Button
                              key={entry.student.id}
                              type="button"
                              variant={isSelected ? "default" : "outline"}
                              className={`h-9 gap-2 ${isSelected ? "" : "border-border/80 bg-card/60"}`}
                              onClick={() => toggleDraftStudent(entry.student.id)}
                            >
                              {entry.student.name}
                            </Button>
                          );
                        })
                      ) : (
                        <p className="text-sm leading-6 text-muted-foreground">
                          Invite students first, then you can group them here.
                        </p>
                      )}
                    </div>
                  </div>

                  {!!draftGroupStudents.length && (
                    <div className="rounded-[1rem] border border-border/80 bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                      Ready to add: {draftGroupStudents.map((entry) => entry.student.name).join(", ")}
                    </div>
                  )}

                  <Button
                    type="button"
                    className="h-11 gap-2"
                    onClick={() => createGroupMutation.mutate()}
                    disabled={createGroupMutation.isPending || !groupName.trim()}
                  >
                    {createGroupMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Users className="h-4 w-4" />
                    )}
                    {createGroupMutation.isPending ? "Creating group..." : "Create group"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-[1.35rem] border border-border/80 bg-card/60 p-5">
              <div className="flex items-center gap-2 text-foreground">
                <BookOpen className="h-4 w-4 text-primary" />
                <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Assign admin tasks</p>
              </div>

              <div className="mt-4 grid gap-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Button
                    type="button"
                    variant={targetType === "student" ? "default" : "outline"}
                    className={`h-11 justify-start ${targetType === "student" ? "" : "border-border/80 bg-background/70"}`}
                    onClick={() => setTargetType("student")}
                  >
                    Individual student
                  </Button>
                  <Button
                    type="button"
                    variant={targetType === "group" ? "default" : "outline"}
                    className={`h-11 justify-start ${targetType === "group" ? "" : "border-border/80 bg-background/70"}`}
                    onClick={() => setTargetType("group")}
                    disabled={!groups.length}
                  >
                    Named group
                  </Button>
                </div>

                <div className="rounded-[1.1rem] border border-border/80 bg-background/45 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Current target</p>
                  <p className="mt-2 text-base text-foreground">
                    {targetType === "group"
                      ? selectedGroup?.name || "Choose a group first"
                      : selectedStudent?.student.name || "Choose a student first"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {targetType === "group"
                      ? selectedGroup
                        ? `${selectedGroup.memberCount} students will receive the same bundle, an in-app notification, and an individual email.`
                        : "Create or select a group to share one assignment bundle with multiple students at once."
                      : selectedStudent
                        ? `${selectedStudent.student.email} will receive the bundle in tasks, notifications, and email.`
                        : "Select a student from the roster before you dispatch the bundle."}
                  </p>
                </div>

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

                <div className="rounded-[1.1rem] border border-border/80 bg-background/45 px-4 py-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Deadline date</p>
                      <Input
                        type="date"
                        value={deadlineDate}
                        onChange={(event) => setDeadlineDate(event.target.value)}
                        className="mt-2 h-11 border-border/80 bg-background/70"
                      />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Deadline time</p>
                      <Input
                        type="time"
                        value={deadlineTime}
                        onChange={(event) => setDeadlineTime(event.target.value)}
                        className="mt-2 h-11 border-border/80 bg-background/70"
                      />
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Default deadline is next day at 9:00 AM. If the admin leaves the deadline untouched, the backend keeps that safe fallback instead of dropping to an old same-day time.
                  </p>
                </div>

                <div className="rounded-[1.1rem] border border-border/80 bg-background/45 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Tasks in this bundle</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Keep the default drills, edit the task names, or add extra name and link pairs.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 gap-2 border-border/80 bg-card/60"
                      onClick={addAssignmentItem}
                    >
                      <Plus className="h-4 w-4" />
                      Add task
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {assignmentItems.map((item, index) => (
                      <div
                        key={item.id}
                        className="rounded-[1rem] border border-border/80 bg-card/60 px-4 py-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                            Task {index + 1}
                          </p>
                          <button
                            type="button"
                            className="rounded-full p-1 text-muted-foreground transition hover:bg-background/80 hover:text-foreground"
                            onClick={() => removeAssignmentItem(item.id)}
                            disabled={assignmentItems.length <= 1}
                            aria-label={`Remove task ${index + 1}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <Input
                            value={item.title}
                            onChange={(event) => updateAssignmentItem(item.id, "title", event.target.value)}
                            placeholder="Task name"
                            className="h-11 border-border/80 bg-background/70"
                          />
                          <Input
                            value={item.referenceUrl}
                            onChange={(event) => updateAssignmentItem(item.id, "referenceUrl", event.target.value)}
                            placeholder="Optional link, for example https://leetcode.com/problems/..."
                            className="h-11 border-border/80 bg-background/70"
                          />
                        </div>

                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  type="button"
                  className="h-11 gap-2"
                  onClick={() => createCapsuleMutation.mutate()}
                  disabled={
                    createCapsuleMutation.isPending ||
                    (targetType === "student" ? !selectedStudentId : !selectedGroupId)
                  }
                >
                  {createCapsuleMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4" />
                  )}
                  {createCapsuleMutation.isPending
                    ? "Assigning..."
                    : targetType === "group"
                      ? "Assign to selected group"
                      : "Assign to selected student"}
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
                <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Recent admin assignments</p>
              </div>

              <div className="mt-4 grid gap-3">
                {selectedStudent.practiceCapsules.length ? (
                  selectedStudent.practiceCapsules.map((capsule) => (
                    <PracticeCapsuleCard key={capsule.bundleId} capsule={capsule} />
                  ))
                ) : (
                  <div className="rounded-[1.1rem] border border-border/80 bg-background/45 px-4 py-4 text-sm text-muted-foreground">
                    No admin assignments have been shared yet.
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
