import { useDeferredValue, useEffect, useMemo, useState } from "react";
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
  Search,
  ShieldCheck,
  Sigma,
  UserPlus,
  UserRoundSearch,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import ClearHistoryButton from "@/components/ClearHistoryButton";
import PageStatusPanel from "@/components/PageStatusPanel";
import SoftSyncNotice from "@/components/SoftSyncNotice";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQueryErrorLogger } from "@/hooks/use-query-error-logger";
import {
  addCoachGroupMembers,
  clearCoachPracticeCapsuleHistory,
  clearCoachProgressHistory,
  clearCoachStudentProofHistory,
  createCoachGroup,
  createPracticeCapsule,
  fetchCoachGroupCandidates,
  fetchCoachGroups,
  fetchCoachStudents,
  type CoachGroupCandidate,
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

function isAssignableGroupMember(member: {
  role?: "admin" | "user";
  accessTier?: "standard" | "observer";
} | null | undefined) {
  return member?.role === "user" && member.accessTier !== "observer";
}

function getGroupCandidateLabel(candidate: CoachGroupCandidate) {
  return candidate.role === "admin" ? `${candidate.name} (Admin)` : candidate.name;
}

function matchesSearch(segments: Array<string | null | undefined>, rawQuery: string) {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return true;
  }

  return segments.some((segment) => String(segment || "").toLowerCase().includes(query));
}

function toggleSelection(list: string[], value: string, checked: boolean | "indeterminate") {
  if (checked) {
    return list.includes(value) ? list : [...list, value];
  }

  return list.filter((item) => item !== value);
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
      type: "verbal",
    }),
    createAssignmentItemDraft({
      title: "Aptitude Drill",
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

function PracticeCapsuleCard({
  capsule,
  selected = false,
  onSelectedChange,
}: {
  capsule: PracticeCapsule;
  selected?: boolean;
  onSelectedChange?: (checked: boolean | "indeterminate") => void;
}) {
  const completedCount = capsule.items.filter((item) => item.status === "completed").length;

  return (
    <article className="rounded-[1.2rem] border border-border/80 bg-background/45 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          {onSelectedChange && (
            <Checkbox
              checked={selected}
              onCheckedChange={onSelectedChange}
              className="mt-1"
              aria-label={`Select assignment bundle ${capsule.title}`}
            />
          )}
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

function ProgressHistoryCard({
  entry,
  selected = false,
  onSelectedChange,
}: {
  entry: StudentOversightRecord["progressHistory"][number];
  selected?: boolean;
  onSelectedChange?: (checked: boolean | "indeterminate") => void;
}) {
  return (
    <article className="rounded-[1.1rem] border border-border/80 bg-background/45 p-4">
      <div className="flex gap-3">
        {onSelectedChange && (
          <Checkbox
            checked={selected}
            onCheckedChange={onSelectedChange}
            className="mt-1"
            aria-label={`Select progress snapshot ${entry.statDate}`}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {formatShortDate(entry.statDate)}
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground/80">
                Execution {Math.round(Number(entry.executionRate) || 0)}% / Readiness{" "}
                {Math.round(Number(entry.readinessScore) || 0)}% / Consistency{" "}
                {Math.round(Number(entry.consistencyScore) || 0)}%
              </p>
            </div>
            <p className="text-sm uppercase tracking-[0.16em] text-muted-foreground">
              {entry.tasksCompleted} tasks / {Number(entry.totalHours || 0).toFixed(1)}h
            </p>
          </div>
        </div>
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
  const [rosterSearch, setRosterSearch] = useState("");
  const [groupCandidateSearch, setGroupCandidateSearch] = useState("");
  const [newGroupSearch, setNewGroupSearch] = useState("");
  const [selectedGroupCandidateIds, setSelectedGroupCandidateIds] = useState<string[]>([]);
  const [selectedProgressEntryIds, setSelectedProgressEntryIds] = useState<string[]>([]);
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<string[]>([]);
  const [clearScopeDialog, setClearScopeDialog] = useState<null | "progress" | "assignments">(null);

  const deferredRosterSearch = useDeferredValue(rosterSearch);
  const deferredGroupCandidateSearch = useDeferredValue(groupCandidateSearch);
  const deferredNewGroupSearch = useDeferredValue(newGroupSearch);

  const studentsQuery = useQuery({
    queryKey: ["coach", "students"],
    queryFn: fetchCoachStudents,
  });
  const groupsQuery = useQuery({
    queryKey: ["coach", "groups"],
    queryFn: fetchCoachGroups,
  });
  const groupCandidatesQuery = useQuery({
    queryKey: ["coach", "group-candidates"],
    queryFn: fetchCoachGroupCandidates,
  });

  useQueryErrorLogger("AdminStudentOversightPanel:students", studentsQuery.error);
  useQueryErrorLogger("AdminStudentOversightPanel:groups", groupsQuery.error);
  useQueryErrorLogger("AdminStudentOversightPanel:group-candidates", groupCandidatesQuery.error);

  const students = useMemo(() => studentsQuery.data || [], [studentsQuery.data]);
  const groups = useMemo(() => groupsQuery.data || [], [groupsQuery.data]);
  const groupCandidates = useMemo(() => groupCandidatesQuery.data || [], [groupCandidatesQuery.data]);
  const isBooting = studentsQuery.isPending && !students.length;
  const hasPrimarySyncError = studentsQuery.isError;
  const hasSecondarySyncIssue = groupsQuery.isError || groupCandidatesQuery.isError;

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
  const groupedStudentIds = useMemo(
    () => new Set(groups.flatMap((group) => group.members.map((member) => member.userId))),
    [groups],
  );
  const selectedGroupMemberIds = useMemo(
    () => new Set((selectedGroup?.members || []).map((member) => member.userId)),
    [selectedGroup],
  );
  const availableStudentsForSelectedGroup = useMemo(
    () =>
      groupCandidates.filter(
        (entry) =>
          !selectedGroupMemberIds.has(entry.id)
          && !groupedStudentIds.has(entry.id),
      ),
    [groupCandidates, groupedStudentIds, selectedGroupMemberIds],
  );
  const availableStudentsForNewGroup = useMemo(
    () => groupCandidates.filter((entry) => !groupedStudentIds.has(entry.id)),
    [groupCandidates, groupedStudentIds],
  );
  const draftGroupStudents = useMemo(
    () => groupCandidates.filter((entry) => draftGroupMemberIds.includes(entry.id)),
    [draftGroupMemberIds, groupCandidates],
  );
  const selectedGroupAssignmentCount = useMemo(() => {
    if (!selectedGroup) {
      return 0;
    }

    if (typeof selectedGroup.assignmentRecipientCount === "number") {
      return selectedGroup.assignmentRecipientCount;
    }

    return selectedGroup.members.filter((member) => isAssignableGroupMember(member)).length;
  }, [selectedGroup]);
  const filteredStudents = useMemo(
    () =>
      students.filter((entry) =>
        matchesSearch(
          [
            entry.student.name,
            entry.student.username,
            entry.student.email,
            entry.student.targetRole,
          ],
          deferredRosterSearch,
        ),
      ),
    [deferredRosterSearch, students],
  );
  const filteredAvailableStudentsForSelectedGroup = useMemo(
    () =>
      availableStudentsForSelectedGroup.filter((entry) =>
        matchesSearch([entry.name, entry.username, entry.email, entry.targetRole], deferredGroupCandidateSearch),
      ),
    [availableStudentsForSelectedGroup, deferredGroupCandidateSearch],
  );
  const filteredAvailableStudentsForNewGroup = useMemo(
    () =>
      availableStudentsForNewGroup.filter((entry) =>
        matchesSearch([entry.name, entry.username, entry.email, entry.targetRole], deferredNewGroupSearch),
      ),
    [availableStudentsForNewGroup, deferredNewGroupSearch],
  );
  const selectedGroupStudentRecords = useMemo(() => {
    if (!selectedGroup) {
      return [];
    }

    const memberIds = new Set(
      selectedGroup.members
        .filter((member) => member.role === "user" && member.accessTier !== "observer")
        .map((member) => member.userId),
    );
    return students.filter((entry) => memberIds.has(entry.student.id));
  }, [selectedGroup, students]);
  const selectedGroupProgressCount = useMemo(
    () => selectedGroupStudentRecords.reduce((total, entry) => total + entry.progressHistory.length, 0),
    [selectedGroupStudentRecords],
  );
  const selectedGroupAssignmentIds = useMemo(
    () =>
      Array.from(
        new Set(
          selectedGroupStudentRecords.flatMap((entry) =>
            entry.practiceCapsules
              .map((capsule) => capsule.assignmentId)
              .filter((assignmentId): assignmentId is string => Boolean(assignmentId)),
          ),
        ),
      ),
    [selectedGroupStudentRecords],
  );
  const ungroupedCandidateCount = useMemo(
    () => groupCandidates.filter((entry) => !groupedStudentIds.has(entry.id)).length,
    [groupCandidates, groupedStudentIds],
  );
  const totalAssignmentBundles = useMemo(
    () => students.reduce((total, entry) => total + entry.practiceCapsules.length, 0),
    [students],
  );
  const visibleRosterLabel = deferredRosterSearch.trim()
    ? `${filteredStudents.length} of ${students.length}`
    : `${students.length}`;
  const allSelectedStudentProgressIds = (selectedStudent?.progressHistory || []).map((entry) => entry.id);
  const allSelectedStudentAssignmentIds = (selectedStudent?.practiceCapsules || [])
    .map((capsule) => capsule.assignmentId)
    .filter((assignmentId): assignmentId is string => Boolean(assignmentId));
  const allVisibleGroupCandidateIds = filteredAvailableStudentsForSelectedGroup.map((entry) => entry.id);
  const allVisibleNewGroupCandidateIds = filteredAvailableStudentsForNewGroup.map((entry) => entry.id);

  useEffect(() => {
    setDraftGroupMemberIds((current) =>
      current.filter((studentId) => availableStudentsForNewGroup.some((entry) => entry.id === studentId)),
    );
  }, [availableStudentsForNewGroup]);

  useEffect(() => {
    setSelectedGroupCandidateIds((current) =>
      current.filter((studentId) => availableStudentsForSelectedGroup.some((entry) => entry.id === studentId)),
    );
  }, [availableStudentsForSelectedGroup]);

  useEffect(() => {
    setSelectedProgressEntryIds((current) =>
      current.filter((entryId) => selectedStudent?.progressHistory.some((entry) => entry.id === entryId)),
    );
  }, [selectedStudent]);

  useEffect(() => {
    setSelectedAssignmentIds((current) =>
      current.filter((assignmentId) =>
        selectedStudent?.practiceCapsules.some((capsule) => capsule.assignmentId === assignmentId),
      ),
    );
  }, [selectedStudent]);

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

  function toggleSelectedGroupCandidate(studentId: string, checked: boolean | "indeterminate") {
    setSelectedGroupCandidateIds((current) => toggleSelection(current, studentId, checked));
  }

  function toggleSelectedProgressEntry(entryId: string, checked: boolean | "indeterminate") {
    setSelectedProgressEntryIds((current) => toggleSelection(current, entryId, checked));
  }

  function toggleSelectedAssignment(assignmentId: string, checked: boolean | "indeterminate") {
    setSelectedAssignmentIds((current) => toggleSelection(current, assignmentId, checked));
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
      setNewGroupSearch("");
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
        throw new Error("Choose a group before adding members.");
      }

      return addCoachGroupMembers(selectedGroupId, studentUserIds);
    },
    onSuccess: async (group: CoachGroup) => {
      setSelectedGroupId(group.id);
      setSelectedGroupCandidateIds([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["coach", "groups"] }),
        queryClient.invalidateQueries({ queryKey: ["coach", "students"] }),
      ]);
      toast.success(`Members added to ${group.name}.`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to add members to the group.");
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
      toast.success(`Member removed from ${group.name}.`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to remove this member from the group.");
    },
  });

  const clearProofHistoryMutation = useMutation({
    mutationFn: () => {
      if (!selectedStudentId) {
        throw new Error("Choose a student before clearing proof history.");
      }

      return clearCoachStudentProofHistory(selectedStudentId);
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["coach", "students"] });
      toast.success(
        result.deleted
          ? `Proof history cleared from ${result.deleted} uploaded item${result.deleted === 1 ? "" : "s"}.`
          : "Proof history was already empty for this student.",
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to clear this student's proof history.");
    },
  });

  const clearProgressHistoryMutation = useMutation({
    mutationFn: async (
      payload:
        | { scope: "selected"; entryIds: string[] }
        | { scope: "student"; studentUserId: string }
        | { scope: "group"; groupId: string },
    ) => clearCoachProgressHistory(payload),
    onSuccess: async (result, variables) => {
      setSelectedProgressEntryIds([]);
      setClearScopeDialog((current) => (current === "progress" ? null : current));
      await queryClient.invalidateQueries({ queryKey: ["coach", "students"] });
      toast.success(
        result.deleted
          ? variables.scope === "selected"
            ? `Cleared ${result.deleted} saved snapshot${result.deleted === 1 ? "" : "s"}.`
            : variables.scope === "group"
              ? `Cleared ${result.deleted} saved snapshot${result.deleted === 1 ? "" : "s"} across the selected group.`
              : `Cleared ${result.deleted} saved snapshot${result.deleted === 1 ? "" : "s"} for this student.`
          : "There were no saved snapshots to clear for that scope.",
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to clear saved progress history.");
    },
  });

  const clearAssignmentHistoryMutation = useMutation({
    mutationFn: async (payload: { studentUserId?: string; groupId?: string; assignmentIds: string[] }) =>
      clearCoachPracticeCapsuleHistory(payload),
    onSuccess: async (result, variables) => {
      setSelectedAssignmentIds([]);
      setClearScopeDialog((current) => (current === "assignments" ? null : current));
      await queryClient.invalidateQueries({ queryKey: ["coach", "students"] });
      await queryClient.invalidateQueries({ queryKey: ["coach", "groups"] });
      toast.success(
        result.deleted
          ? variables.groupId
            ? `Cleared ${result.deleted} admin assignment${result.deleted === 1 ? "" : "s"} across the selected group.`
            : `Cleared ${result.deleted} admin assignment${result.deleted === 1 ? "" : "s"} for this student.`
          : "There were no matching admin assignments to clear.",
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to clear admin assignment history.");
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
      if (targetType === "group" && selectedGroupAssignmentCount < 1) {
        throw new Error("This group needs at least one student before it can receive assignments.");
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
        queryClient.invalidateQueries({ queryKey: ["coach", "groups"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications", "recent"] }),
      ]);
      toast.success(buildAssignmentSuccessMessage(result));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to assign practice capsule.");
    },
  });

  const allStudentProgressSelected =
    allSelectedStudentProgressIds.length > 0
    && selectedProgressEntryIds.length === allSelectedStudentProgressIds.length;
  const allStudentAssignmentsSelected =
    allSelectedStudentAssignmentIds.length > 0
    && selectedAssignmentIds.length === allSelectedStudentAssignmentIds.length;
  const allVisibleGroupCandidatesSelected =
    allVisibleGroupCandidateIds.length > 0
    && allVisibleGroupCandidateIds.every((candidateId) => selectedGroupCandidateIds.includes(candidateId));
  const allVisibleDraftCandidatesSelected =
    allVisibleNewGroupCandidateIds.length > 0
    && allVisibleNewGroupCandidateIds.every((candidateId) => draftGroupMemberIds.includes(candidateId));

  function handleSelectVisibleGroupCandidates() {
    setSelectedGroupCandidateIds((current) =>
      allVisibleGroupCandidatesSelected
        ? current.filter((candidateId) => !allVisibleGroupCandidateIds.includes(candidateId))
        : Array.from(new Set([...current, ...allVisibleGroupCandidateIds])),
    );
  }

  function handleSelectVisibleDraftCandidates() {
    setDraftGroupMemberIds((current) =>
      allVisibleDraftCandidatesSelected
        ? current.filter((candidateId) => !allVisibleNewGroupCandidateIds.includes(candidateId))
        : Array.from(new Set([...current, ...allVisibleNewGroupCandidateIds])),
    );
  }

  function handleSelectAllProgressSnapshots() {
    setSelectedProgressEntryIds(allStudentProgressSelected ? [] : allSelectedStudentProgressIds);
  }

  function handleSelectAllAssignments() {
    setSelectedAssignmentIds(allStudentAssignmentsSelected ? [] : allSelectedStudentAssignmentIds);
  }

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

      {isBooting && (
        <PageStatusPanel
          eyebrow="Coaching sync"
          title="Loading invited students and groups."
          description="PlacePrep is restoring student progress snapshots, proof uploads, coaching groups, and assigned practice capsules."
          loading
        />
      )}

      {hasPrimarySyncError && (
        <PageStatusPanel
          eyebrow="Coaching fallback"
          title="Student oversight could not be fully loaded."
          description="Retry to bring the latest student telemetry, group membership, and practice links back into view."
          actionLabel="Retry"
          onAction={() => {
            void studentsQuery.refetch();
            void groupsQuery.refetch();
            void groupCandidatesQuery.refetch();
          }}
          tone="danger"
        />
      )}

      {hasSecondarySyncIssue && !hasPrimarySyncError && (
        <SoftSyncNotice
          title="Some admin coordination data is temporarily unavailable."
          description="Student telemetry is still visible. Retry when you want group membership and candidate lists back in sync."
          actionLabel="Retry"
          onAction={() => {
            void groupsQuery.refetch();
            void groupCandidatesQuery.refetch();
          }}
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

      {!!students.length && (
        <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <OversightMetric
            label="Students"
            value={String(students.length)}
            helper="Accounts currently visible to admin oversight."
          />
          <OversightMetric
            label="Groups"
            value={String(groups.length)}
            helper="Named cohorts that can receive one assignment bundle together."
          />
          <OversightMetric
            label="Ungrouped"
            value={String(ungroupedCandidateCount)}
            helper="Eligible accounts still waiting to be clustered into a group."
          />
          <OversightMetric
            label="Assignments"
            value={String(totalAssignmentBundles)}
            helper="Recent admin-shared bundles still visible across the roster."
          />
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

              <div className="mt-4 rounded-[1rem] border border-border/80 bg-background/45 px-4 py-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Search className="h-4 w-4" />
                  <Input
                    value={rosterSearch}
                    onChange={(event) => setRosterSearch(event.target.value)}
                    placeholder="Search students by name, username, email, or role"
                    className="h-10 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
                  />
                </div>
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Showing {visibleRosterLabel} student{students.length === 1 ? "" : "s"}
                </p>
              </div>

              <div className="mt-4 grid gap-3">
                {filteredStudents.map((entry) => {
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
                {!filteredStudents.length && (
                  <div className="rounded-[1.1rem] border border-border/80 bg-background/45 px-4 py-4 text-sm text-muted-foreground">
                    No students match this search yet.
                  </div>
                )}
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
                          <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                            {member.role === "admin" ? "Admin" : "Student"}
                          </span>
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
                        No members in this group yet.
                      </p>
                    )}
                  </div>

                  <div className="mt-4 border-t border-border/70 pt-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          Add members to this group
                        </p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          Search through ungrouped candidates, select visible rows, then add them in one pass.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 gap-2 border-border/80 bg-card/60"
                          onClick={handleSelectVisibleGroupCandidates}
                          disabled={!allVisibleGroupCandidateIds.length}
                        >
                          {allVisibleGroupCandidatesSelected ? "Clear visible" : "Select visible"}
                        </Button>
                        <Button
                          type="button"
                          className="h-9 gap-2"
                          onClick={() => addGroupMembersMutation.mutate(selectedGroupCandidateIds)}
                          disabled={addGroupMembersMutation.isPending || !selectedGroupCandidateIds.length}
                        >
                          <UserPlus className="h-4 w-4" />
                          Add selected
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 rounded-[1rem] border border-border/80 bg-card/60 px-4 py-3">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Search className="h-4 w-4" />
                        <Input
                          value={groupCandidateSearch}
                          onChange={(event) => setGroupCandidateSearch(event.target.value)}
                          placeholder="Search candidates by name, email, or target role"
                          className="h-10 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {availableStudentsForSelectedGroup.length ? (
                        filteredAvailableStudentsForSelectedGroup.map((entry) => (
                          <label
                            key={entry.id}
                            className="inline-flex cursor-pointer items-center gap-3 rounded-full border border-border/80 bg-card/60 px-3 py-2 text-sm text-foreground transition hover:border-primary/30"
                          >
                            <Checkbox
                              checked={selectedGroupCandidateIds.includes(entry.id)}
                              onCheckedChange={(checked) => toggleSelectedGroupCandidate(entry.id, checked)}
                            />
                            {getGroupCandidateLabel(entry)}
                          </label>
                        ))
                      ) : (
                        <p className="text-sm leading-6 text-muted-foreground">
                          Everyone eligible is already part of a group.
                        </p>
                      )}
                      {!!availableStudentsForSelectedGroup.length && !filteredAvailableStudentsForSelectedGroup.length && (
                        <p className="text-sm leading-6 text-muted-foreground">
                          No candidates match this search.
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
                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          Add initial members
                        </p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          Select multiple students at once so large cohorts do not need one-by-one setup.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 gap-2 border-border/80 bg-card/60"
                        onClick={handleSelectVisibleDraftCandidates}
                        disabled={!allVisibleNewGroupCandidateIds.length}
                      >
                        {allVisibleDraftCandidatesSelected ? "Clear visible" : "Select visible"}
                      </Button>
                    </div>

                    <div className="mt-4 rounded-[1rem] border border-border/80 bg-card/60 px-4 py-3">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Search className="h-4 w-4" />
                        <Input
                          value={newGroupSearch}
                          onChange={(event) => setNewGroupSearch(event.target.value)}
                          placeholder="Search ungrouped candidates by name, email, or role"
                          className="h-10 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {availableStudentsForNewGroup.length ? (
                        filteredAvailableStudentsForNewGroup.map((entry) => {
                          const isSelected = draftGroupMemberIds.includes(entry.id);

                          return (
                            <label
                              key={entry.id}
                              className={`inline-flex cursor-pointer items-center gap-3 rounded-full border px-3 py-2 text-sm transition ${
                                isSelected
                                  ? "border-primary/35 bg-primary/10 text-foreground"
                                  : "border-border/80 bg-card/60 text-foreground hover:border-primary/30"
                              }`}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleDraftStudent(entry.id)}
                              />
                              {getGroupCandidateLabel(entry)}
                            </label>
                          );
                        })
                      ) : (
                        <p className="text-sm leading-6 text-muted-foreground">
                          Every eligible account is already grouped. Remove someone from an existing group before adding them here.
                        </p>
                      )}
                      {!!availableStudentsForNewGroup.length && !filteredAvailableStudentsForNewGroup.length && (
                        <p className="text-sm leading-6 text-muted-foreground">
                          No ungrouped candidates match this search.
                        </p>
                      )}
                    </div>
                  </div>

                  {!!draftGroupStudents.length && (
                    <div className="rounded-[1rem] border border-border/80 bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                      Ready to add: {draftGroupStudents.map((entry) => getGroupCandidateLabel(entry)).join(", ")}
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
                        ? selectedGroupAssignmentCount > 0
                          ? `${selectedGroupAssignmentCount} student${selectedGroupAssignmentCount === 1 ? "" : "s"} in this group will receive the same bundle, an in-app notification, and an individual email.`
                          : "This group currently has only admin members. Add at least one student before assigning a bundle."
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
                    (targetType === "student"
                      ? !selectedStudentId
                      : !selectedGroupId || selectedGroupAssignmentCount < 1)
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
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-foreground">
                  <Camera className="h-4 w-4 text-primary" />
                  <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Recent proof uploads</p>
                </div>

                <ClearHistoryButton
                  title="Clear this student's proof history?"
                  description="This removes saved proof uploads for this student account. Profile avatars will be kept."
                  onConfirm={() => clearProofHistoryMutation.mutate()}
                  pending={clearProofHistoryMutation.isPending}
                  disabled={!selectedStudent.recentProofs.length}
                  className="h-10 gap-2 border-border/80 bg-background/70"
                />
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
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-foreground">
                    <Activity className="h-4 w-4 text-primary" />
                    <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Saved progress snapshots</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Clear only selected rows, or clear all for this student or the selected group.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 gap-2 border-border/80 bg-background/70"
                    disabled={!allSelectedStudentProgressIds.length}
                    onClick={handleSelectAllProgressSnapshots}
                  >
                    {allStudentProgressSelected ? "Clear selection" : "Select all"}
                  </Button>
                  <ClearHistoryButton
                    title="Clear selected saved snapshots?"
                    description="Only the selected snapshot rows for this student will be removed."
                    onConfirm={() =>
                      clearProgressHistoryMutation.mutate({
                        scope: "selected",
                        entryIds: selectedProgressEntryIds,
                      })
                    }
                    pending={clearProgressHistoryMutation.isPending}
                    disabled={!selectedProgressEntryIds.length}
                    buttonLabel="Clear selected"
                    confirmLabel="Clear selected"
                    className="h-10 gap-2 border-border/80 bg-background/70"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 gap-2 border-border/80 bg-background/70"
                    disabled={!selectedStudent.progressHistory.length}
                    onClick={() => setClearScopeDialog("progress")}
                  >
                    Clear all
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {selectedStudent.progressHistory.length ? (
                  selectedStudent.progressHistory.map((entry) => (
                    <ProgressHistoryCard
                      key={entry.id}
                      entry={entry}
                      selected={selectedProgressEntryIds.includes(entry.id)}
                      onSelectedChange={(checked) => toggleSelectedProgressEntry(entry.id, checked)}
                    />
                  ))
                ) : (
                  <div className="rounded-[1.1rem] border border-border/80 bg-background/45 px-4 py-4 text-sm text-muted-foreground">
                    No saved snapshots yet for this student.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[1.35rem] border border-border/80 bg-card/60 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-foreground">
                    <Sigma className="h-4 w-4 text-primary" />
                    <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Recent admin assignments</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Select the bundles you want gone. Clear all can target only this student or everyone in the selected group.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 gap-2 border-border/80 bg-background/70"
                    disabled={!allSelectedStudentAssignmentIds.length}
                    onClick={handleSelectAllAssignments}
                  >
                    {allStudentAssignmentsSelected ? "Clear selection" : "Select all"}
                  </Button>
                  <ClearHistoryButton
                    title="Clear selected admin assignments?"
                    description="Only the selected assignment bundles for this student will be removed from the recent admin assignment history."
                    onConfirm={() =>
                      clearAssignmentHistoryMutation.mutate({
                        studentUserId: selectedStudent.student.id,
                        assignmentIds: selectedAssignmentIds,
                      })
                    }
                    pending={clearAssignmentHistoryMutation.isPending}
                    disabled={!selectedAssignmentIds.length}
                    buttonLabel="Clear selected"
                    confirmLabel="Clear selected"
                    className="h-10 gap-2 border-border/80 bg-background/70"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 gap-2 border-border/80 bg-background/70"
                    disabled={!selectedStudent.practiceCapsules.length}
                    onClick={() => setClearScopeDialog("assignments")}
                  >
                    Clear all
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {selectedStudent.practiceCapsules.length ? (
                  selectedStudent.practiceCapsules.map((capsule) => (
                    <PracticeCapsuleCard
                      key={capsule.bundleId}
                      capsule={capsule}
                      selected={capsule.assignmentId ? selectedAssignmentIds.includes(capsule.assignmentId) : false}
                      onSelectedChange={
                        capsule.assignmentId
                          ? (checked) => toggleSelectedAssignment(capsule.assignmentId as string, checked)
                          : undefined
                      }
                    />
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

      <Dialog open={clearScopeDialog === "progress"} onOpenChange={(open) => setClearScopeDialog(open ? "progress" : null)}>
        <DialogContent className="border-border/80 bg-card text-foreground">
          <DialogHeader>
            <DialogTitle>Clear all saved progress snapshots</DialogTitle>
            <DialogDescription>
              Choose whether the clear-all action should affect only the selected student or every student inside the selected group.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <button
              type="button"
              className="rounded-[1rem] border border-border/80 bg-background/55 px-4 py-4 text-left transition hover:border-primary/30"
              onClick={() => {
                if (!selectedStudent) {
                  return;
                }

                clearProgressHistoryMutation.mutate({
                  scope: "student",
                  studentUserId: selectedStudent.student.id,
                });
              }}
              disabled={clearProgressHistoryMutation.isPending || !selectedStudent}
            >
              <p className="text-sm uppercase tracking-[0.16em] text-muted-foreground">This student</p>
              <p className="mt-2 text-base text-foreground">{selectedStudent?.student.name || "Selected student"}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Clear every saved progress snapshot for the selected student only.
              </p>
            </button>

            <button
              type="button"
              className="rounded-[1rem] border border-border/80 bg-background/55 px-4 py-4 text-left transition hover:border-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                if (!selectedGroup) {
                  return;
                }

                clearProgressHistoryMutation.mutate({
                  scope: "group",
                  groupId: selectedGroup.id,
                });
              }}
              disabled={clearProgressHistoryMutation.isPending || !selectedGroup || selectedGroupProgressCount < 1}
            >
              <p className="text-sm uppercase tracking-[0.16em] text-muted-foreground">Selected group</p>
              <p className="mt-2 text-base text-foreground">{selectedGroup?.name || "No group selected"}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {selectedGroup
                  ? `Clear ${selectedGroupProgressCount} saved snapshot${selectedGroupProgressCount === 1 ? "" : "s"} across this group's students.`
                  : "Choose a group first if you want to clear history for more than one student."}
              </p>
            </button>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" className="border-border/80 bg-background/70" onClick={() => setClearScopeDialog(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={clearScopeDialog === "assignments"} onOpenChange={(open) => setClearScopeDialog(open ? "assignments" : null)}>
        <DialogContent className="border-border/80 bg-card text-foreground">
          <DialogHeader>
            <DialogTitle>Clear all recent admin assignments</DialogTitle>
            <DialogDescription>
              Choose whether the clear-all action should affect this student only or the whole selected group.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <button
              type="button"
              className="rounded-[1rem] border border-border/80 bg-background/55 px-4 py-4 text-left transition hover:border-primary/30"
              onClick={() => {
                if (!selectedStudent || !allSelectedStudentAssignmentIds.length) {
                  return;
                }

                clearAssignmentHistoryMutation.mutate({
                  studentUserId: selectedStudent.student.id,
                  assignmentIds: allSelectedStudentAssignmentIds,
                });
              }}
              disabled={
                clearAssignmentHistoryMutation.isPending
                || !selectedStudent
                || !allSelectedStudentAssignmentIds.length
              }
            >
              <p className="text-sm uppercase tracking-[0.16em] text-muted-foreground">This student</p>
              <p className="mt-2 text-base text-foreground">{selectedStudent?.student.name || "Selected student"}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Remove every recent admin assignment bundle currently shown for this student.
              </p>
            </button>

            <button
              type="button"
              className="rounded-[1rem] border border-border/80 bg-background/55 px-4 py-4 text-left transition hover:border-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                if (!selectedGroup || !selectedGroupAssignmentIds.length) {
                  return;
                }

                clearAssignmentHistoryMutation.mutate({
                  groupId: selectedGroup.id,
                  assignmentIds: selectedGroupAssignmentIds,
                });
              }}
              disabled={
                clearAssignmentHistoryMutation.isPending
                || !selectedGroup
                || !selectedGroupAssignmentIds.length
              }
            >
              <p className="text-sm uppercase tracking-[0.16em] text-muted-foreground">Selected group</p>
              <p className="mt-2 text-base text-foreground">{selectedGroup?.name || "No group selected"}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {selectedGroup
                  ? `Remove ${selectedGroupAssignmentIds.length} tracked assignment bundle${selectedGroupAssignmentIds.length === 1 ? "" : "s"} across this group's students.`
                  : "Choose a group first if you want to clear assignments for multiple students."}
              </p>
            </button>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" className="border-border/80 bg-background/70" onClick={() => setClearScopeDialog(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
