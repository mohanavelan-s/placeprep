import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Code2, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import HoursInput from "@/components/HoursInput";
import PageStatusPanel from "@/components/PageStatusPanel";
import StudentPracticeCapsulesPanel from "@/components/StudentPracticeCapsulesPanel";
import TaskStatusControl from "@/components/TaskStatusControl";
import { TasksSkeleton } from "@/components/WorkspaceSkeletons";
import WorkProofPanel from "@/components/WorkProofPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { isObserverUser } from "@/lib/access";
import {
  createTask,
  deleteTask,
  fetchTasks,
  type Task,
  type TaskStatus,
  updateTask,
} from "@/lib/api";
import { useQueryErrorLogger } from "@/hooks/use-query-error-logger";
import { formatHoursFromMinutes, parseHoursToMinutes } from "@/lib/time";
import { allowsManualCompletion, getTaskVerificationHint } from "@/lib/task-verification";
import type { UiLanguage } from "@/lib/ui-language";

const statuses = ["all", "pending", "in_progress", "completed", "skipped"] as const;
const categories = ["all", "DSA", "Core", "Project", "Aptitude", "Resume", "MockInterview", "Other"] as const;

const TASKS_PAGE_TRANSLATIONS: Record<string, Record<Exclude<UiLanguage, "english">, string>> = {
  "Task system": {
    tamil: "பணி அமைப்பு",
    hindi: "टास्क सिस्टम",
  },
  "Keep every mission visible.": {
    tamil: "ஒவ்வொரு பணியும் தெளிவாக கண்ணில் படுமாறு வைத்திருங்கள்.",
    hindi: "हर कार्य को साफ़ और दिखाई देने वाला रखें।",
  },
  Total: {
    tamil: "மொத்தம்",
    hindi: "कुल",
  },
  "In progress": {
    tamil: "நடைமுறையில்",
    hindi: "प्रगति में",
  },
  Pending: {
    tamil: "நிலுவை",
    hindi: "लंबित",
  },
  Completed: {
    tamil: "முடிந்தது",
    hindi: "पूर्ण",
  },
  Skipped: {
    tamil: "தவிர்க்கப்பட்டது",
    hindi: "छोड़ा गया",
  },
  "Quick add": {
    tamil: "விரைவு சேர்க்கை",
    hindi: "तेज़ जोड़ें",
  },
  "New task title": {
    tamil: "புதிய பணி தலைப்பு",
    hindi: "नया टास्क शीर्षक",
  },
  Add: {
    tamil: "சேர்",
    hindi: "जोड़ें",
  },
  Filters: {
    tamil: "வடிகட்டிகள்",
    hindi: "फ़िल्टर",
  },
  Status: {
    tamil: "நிலை",
    hindi: "स्थिति",
  },
  Category: {
    tamil: "வகை",
    hindi: "श्रेणी",
  },
  "All statuses": {
    tamil: "அனைத்து நிலைகள்",
    hindi: "सभी स्थितियाँ",
  },
  "All categories": {
    tamil: "அனைத்து வகைகள்",
    hindi: "सभी श्रेणियाँ",
  },
  "Task list": {
    tamil: "பணி பட்டியல்",
    hindi: "टास्क सूची",
  },
  "Execution board": {
    tamil: "செயல்பாட்டு பலகை",
    hindi: "निष्पादन बोर्ड",
  },
  "Task fallback": {
    tamil: "பணி மாற்று நிலை",
    hindi: "टास्क फॉलबैक",
  },
  Retry: {
    tamil: "மீண்டும் முயலுங்கள்",
    hindi: "फिर से कोशिश करें",
  },
  "Task data could not be loaded.": {
    tamil: "பணி தகவலை ஏற்ற முடியவில்லை.",
    hindi: "टास्क डेटा लोड नहीं हो सका।",
  },
  "The board stayed visible with safe defaults. Retry to fetch your latest tasks.": {
    tamil: "பாதுகாப்பான இயல்புநிலைகளுடன் பலகை தெரிகிறது. சமீபத்திய பணிகளை மீண்டும் பெற முயலுங்கள்.",
    hindi: "बोर्ड सुरक्षित डिफ़ॉल्ट के साथ दिखाई दे रहा है। अपने नवीनतम टास्क फिर से लाने के लिए पुनः प्रयास करें।",
  },
  Due: {
    tamil: "கடைசி நேரம்",
    hindi: "देय",
  },
  Focus: {
    tamil: "கவனம்",
    hindi: "फ़ोकस",
  },
  "Hide details": {
    tamil: "விவரங்களை மறை",
    hindi: "विवरण छिपाएँ",
  },
  Details: {
    tamil: "விவரங்கள்",
    hindi: "विवरण",
  },
  Delete: {
    tamil: "நீக்கு",
    hindi: "हटाएँ",
  },
  "Task brief": {
    tamil: "பணி சுருக்கம்",
    hindi: "टास्क सार",
  },
  "Use this task to build one concrete skill and explain the approach clearly before moving on.": {
    tamil: "அடுத்ததிற்கு செல்லும் முன், இந்த பணியின் மூலம் ஒரு தெளிவான திறனை உருவாக்கி அணுகுமுறையை விளக்குங்கள்.",
    hindi: "आगे बढ़ने से पहले इस टास्क से एक ठोस कौशल बनाइए और अपना तरीका स्पष्ट कीजिए।",
  },
  "No tasks match these filters.": {
    tamil: "இந்த வடிகட்டிகளுக்கு பொருந்தும் பணிகள் இல்லை.",
    hindi: "इन फ़िल्टरों से मेल खाते कोई टास्क नहीं हैं।",
  },
  "Generate from Prep Architect or create one manually here.": {
    tamil: "Prep Architect இலிருந்து உருவாக்குங்கள் அல்லது இங்கே கைமுறையாகச் சேர்க்குங்கள்.",
    hindi: "Prep Architect से जनरेट करें या यहाँ हाथ से एक बनाएँ।",
  },
  DSA: {
    tamil: "DSA",
    hindi: "DSA",
  },
  Core: {
    tamil: "மூலப் பாடம்",
    hindi: "कोर",
  },
  Project: {
    tamil: "திட்டம்",
    hindi: "प्रोजेक्ट",
  },
  Aptitude: {
    tamil: "திறனறிதல்",
    hindi: "एप्टीट्यूड",
  },
  Resume: {
    tamil: "ரெஸ்யூமே",
    hindi: "रिज़्यूमे",
  },
  MockInterview: {
    tamil: "மாதிரி நேர்காணல்",
    hindi: "मॉक इंटरव्यू",
  },
  Other: {
    tamil: "மற்றவை",
    hindi: "अन्य",
  },
  "Auto-checks against the saved LeetCode profile. You can also upload proof for this task.": {
    tamil: "சேமிக்கப்பட்ட LeetCode சுயவிவரத்துடன் தானாகச் சரிபார்க்கும். இந்த பணிக்காக ஆதாரமும் பதிவேற்றலாம்.",
    hindi: "सेव किए गए LeetCode प्रोफ़ाइल से अपने आप जाँच करता है। आप इस टास्क के लिए प्रमाण भी अपलोड कर सकते हैं।",
  },
  "Upload linked proof and PlacePrep will verify it before marking this complete.": {
    tamil: "இணைக்கப்பட்ட ஆதாரத்தை பதிவேற்றுங்கள்; இதை முடிந்ததாக குறிக்கும் முன் PlacePrep சரிபார்க்கும்.",
    hindi: "जुड़ा हुआ प्रमाण अपलोड करें और PlacePrep इसे पूर्ण चिह्नित करने से पहले सत्यापित करेगा।",
  },
  "Verified automatically via LeetCode profile or proof upload.": {
    tamil: "LeetCode சுயவிவரம் அல்லது ஆதார பதிவேற்றத்தின் மூலம் தானாகச் சரிபார்க்கப்பட்டது.",
    hindi: "LeetCode प्रोफ़ाइल या प्रमाण अपलोड के माध्यम से अपने आप सत्यापित किया गया।",
  },
};

function formatTaskDueLabel(value?: string | null) {
  if (!value) {
    return "";
  }

  try {
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function supportsCodingLab(task: Task) {
  const metadata = task.metadata || {};
  const searchable = [
    task.category,
    task.subcategory,
    task.title,
    task.referenceLabel,
    task.referenceUrl,
    metadata.problemPlatform,
    metadata.problemSlug,
    metadata.problemTitle,
  ].join(" ");

  return Boolean(metadata.codingLabEnabled)
    || /dsa|coding|leetcode|hackerrank|codechef|algorithm|sql|dbms|database|array|string|tree|graph|stack|queue|dynamic|recursion|backtracking/i.test(searchable);
}

export default function TasksPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const localize = (text: string) => TASKS_PAGE_TRANSLATIONS[text]?.[language] || t(text);
  const localizeStatus = (value: (typeof statuses)[number]) => {
    if (value === "all") {
      return localize("All statuses");
    }

    if (value === "in_progress") {
      return localize("In progress");
    }

    if (value === "completed") {
      return localize("Completed");
    }

    if (value === "skipped") {
      return localize("Skipped");
    }

    return localize("Pending");
  };
  const localizeCategory = (value: (typeof categories)[number]) => (
    value === "all" ? localize("All categories") : localize(value)
  );
  const [status, setStatus] = useState<(typeof statuses)[number]>("all");
  const [category, setCategory] = useState<(typeof categories)[number]>("all");
  const [expandedTaskIds, setExpandedTaskIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [newCategory, setNewCategory] = useState("DSA");
  const [estimatedHours, setEstimatedHours] = useState("0.5");

  const tasksQuery = useQuery({
    queryKey: ["tasks", { status, category }],
    queryFn: () =>
      fetchTasks({
        status: status === "all" ? undefined : status,
        category: category === "all" ? undefined : category,
      }),
  });

  useQueryErrorLogger("TasksPage:tasks", tasksQuery.error);

  const createMutation = useMutation({
    mutationFn: () =>
      createTask({
        title,
        category: newCategory,
        estimatedMinutes: parseHoursToMinutes(estimatedHours, 30),
        status: "pending",
      }),
    onSuccess: () => {
      setTitle("");
      setEstimatedHours("0.5");
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks", "today"] });
      void queryClient.invalidateQueries({ queryKey: ["progress-summary"] });
      toast.success("Task created.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to create task.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ taskId, status: next }: { taskId: string; status: TaskStatus }) =>
      updateTask(taskId, { status: next }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks", "today"] });
      void queryClient.invalidateQueries({ queryKey: ["progress-summary"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to update task.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => deleteTask(taskId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks", "today"] });
      void queryClient.invalidateQueries({ queryKey: ["progress-summary"] });
      toast.success("Task deleted.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to delete task.");
    },
  });

  const tasks = useMemo(
    () => (Array.isArray(tasksQuery.data) ? tasksQuery.data : []),
    [tasksQuery.data],
  );
  const groupedCounts = useMemo(
    () => ({
      total: tasks.length,
      completed: tasks.filter((task) => task.status === "completed").length,
      active: tasks.filter((task) => task.status === "in_progress").length,
    }),
    [tasks]
  );
  const shouldShowStudentPanels = user?.role === "user" && !isObserverUser(user);

  function toggleExpandedTask(taskId: string) {
    setExpandedTaskIds((current) =>
      current.includes(taskId)
        ? current.filter((id) => id !== taskId)
        : [...current, taskId],
    );
  }

  if (tasksQuery.isPending && !tasks.length) {
    return <TasksSkeleton />;
  }

  return (
    <div className="grid gap-6">
      <section className="surface-panel p-6 md:p-7">
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="section-label">{localize("Task system")}</p>
            <h2 className="mt-2 font-heading text-4xl text-foreground md:text-5xl">
              {localize("Keep every mission visible.")}
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/80 bg-card/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{localize("Total")}</p>
              <p className="mt-2 font-heading text-3xl text-foreground">{groupedCounts.total}</p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-card/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{localize("In progress")}</p>
              <p className="mt-2 font-heading text-3xl text-foreground">{groupedCounts.active}</p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-card/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{localize("Completed")}</p>
              <p className="mt-2 font-heading text-3xl text-foreground">{groupedCounts.completed}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-border/80 bg-card/70 p-5">
            <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">{localize("Quick add")}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_170px_auto]">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={localize("New task title")}
                className="h-11 border-border/80 bg-background/70"
              />
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger className="h-11 border-border/80 bg-background/70">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.filter((item) => item !== "all").map((item) => (
                    <SelectItem key={item} value={item}>
                      {localizeCategory(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <HoursInput
                value={estimatedHours}
                min={0.5}
                max={5}
                onChange={(event) => setEstimatedHours(event.target.value)}
                placeholder="1 hr"
                className="h-11 border-border/80 bg-background/70"
              />
              <Button
                type="button"
                className="h-11 gap-2"
                disabled={!title.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                <Plus className="h-4 w-4" />
                {localize("Add")}
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card/70 p-5">
            <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">{localize("Filters")}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Select value={status} onValueChange={(value) => setStatus(value as (typeof statuses)[number])}>
                <SelectTrigger className="h-11 border-border/80 bg-background/70">
                  <SelectValue placeholder={localize("Status")} />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((item) => (
                    <SelectItem key={item} value={item}>
                      {localizeStatus(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={category} onValueChange={(value) => setCategory(value as (typeof categories)[number])}>
                <SelectTrigger className="h-11 border-border/80 bg-background/70">
                  <SelectValue placeholder={localize("Category")} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((item) => (
                    <SelectItem key={item} value={item}>
                      {localizeCategory(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </section>

      <section className="surface-panel overflow-hidden">
        <div className="border-b border-border/70 px-6 py-5">
          <p className="section-label">{localize("Task list")}</p>
          <h3 className="mt-2 font-heading text-3xl text-foreground">{localize("Execution board")}</h3>
        </div>

        <div>
          {tasksQuery.isError && (
            <div className="px-6 py-6">
              <PageStatusPanel
                eyebrow={localize("Task fallback")}
                title={localize("Task data could not be loaded.")}
                description={localize("The board stayed visible with safe defaults. Retry to fetch your latest tasks.")}
                actionLabel={localize("Retry")}
                onAction={() => void tasksQuery.refetch()}
                tone="danger"
              />
            </div>
          )}

          {tasks.map((task: Task) => (
            <div key={task.id} className="mission-row border-b border-border/60 px-6 py-4">
              <div className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-medium text-foreground">{task.title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {localizeCategory(task.category as (typeof categories)[number])} / {formatHoursFromMinutes(task.estimatedMinutes)} / {task.referenceLabel || task.weakArea || localize("Focus")}
                    {task.dueAt ? ` / ${localize("Due")} ${formatTaskDueLabel(task.dueAt)}` : ""}
                  </p>
                  {getTaskVerificationHint(task) && (
                    <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground/80">
                      {localize(getTaskVerificationHint(task) || "")}
                    </p>
                  )}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-muted-foreground"
                  onClick={() => navigate(`/coding-lab/${task.id}`)}
                  disabled={!supportsCodingLab(task)}
                >
                  <Code2 className="h-4 w-4" />
                  Lab
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-muted-foreground"
                  onClick={() => toggleExpandedTask(task.id)}
                >
                  {expandedTaskIds.includes(task.id) ? localize("Hide details") : localize("Details")}
                </Button>

                <TaskStatusControl
                  status={task.status}
                  disabled={updateMutation.isPending && updateMutation.variables?.taskId === task.id}
                  compact
                  allowCompletedSelection={allowsManualCompletion(task)}
                  onChange={(status) => updateMutation.mutate({ taskId: task.id, status })}
                />

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMutation.mutate(task.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  {localize("Delete")}
                </Button>
              </div>

              {expandedTaskIds.includes(task.id) && (
                <div className="mt-4 rounded-[1rem] border border-border/70 bg-background/45 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{localize("Task brief")}</p>
                  <p className="mt-3 text-sm leading-6 text-foreground/82">
                    {task.description || String(task.metadata?.summary || "").trim() || localize("Use this task to build one concrete skill and explain the approach clearly before moving on.")}
                  </p>

                  {task.referenceUrl && (
                    <a
                      href={task.referenceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-2 text-sm text-primary transition hover:text-foreground"
                    >
                      {task.referenceLabel || task.title}
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}

          {!tasks.length && !tasksQuery.isPending && !tasksQuery.isError && (
            <div className="px-6 py-10 text-center">
              <p className="font-heading text-3xl text-foreground">
                {localize("No tasks match these filters.")}
              </p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {localize("Generate from Prep Architect or create one manually here.")}
              </p>
            </div>
          )}
        </div>
      </section>

      {shouldShowStudentPanels && <StudentPracticeCapsulesPanel />}

      {shouldShowStudentPanels && <WorkProofPanel tasks={tasks} />}
    </div>
  );
}
