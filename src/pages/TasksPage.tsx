import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import HoursInput from "@/components/HoursInput";
import PageStatusPanel from "@/components/PageStatusPanel";
import StudentPracticeCapsulesPanel from "@/components/StudentPracticeCapsulesPanel";
import TaskStatusControl from "@/components/TaskStatusControl";
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

const statuses = ["all", "pending", "in_progress", "completed", "skipped"] as const;
const categories = ["all", "DSA", "Core", "Project", "Aptitude", "Resume", "MockInterview", "Other"] as const;

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

export default function TasksPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [status, setStatus] = useState<(typeof statuses)[number]>("all");
  const [category, setCategory] = useState<(typeof categories)[number]>("all");
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

  const tasks = Array.isArray(tasksQuery.data) ? tasksQuery.data : [];
  const groupedCounts = useMemo(
    () => ({
      total: tasks.length,
      completed: tasks.filter((task) => task.status === "completed").length,
      active: tasks.filter((task) => task.status === "in_progress").length,
    }),
    [tasks]
  );
  const shouldShowStudentPanels = user?.role === "user" && !isObserverUser(user);

  return (
    <div className="grid gap-6">
      <section className="surface-panel p-6 md:p-7">
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="section-label">Task system</p>
            <h2 className="mt-2 font-heading text-4xl text-foreground md:text-5xl">
              Keep every mission visible.
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/80 bg-card/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Total</p>
              <p className="mt-2 font-heading text-3xl text-foreground">{groupedCounts.total}</p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-card/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">In progress</p>
              <p className="mt-2 font-heading text-3xl text-foreground">{groupedCounts.active}</p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-card/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Completed</p>
              <p className="mt-2 font-heading text-3xl text-foreground">{groupedCounts.completed}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-border/80 bg-card/70 p-5">
            <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Quick add</p>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_170px_auto]">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="New task title"
                className="h-11 border-border/80 bg-background/70"
              />
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger className="h-11 border-border/80 bg-background/70">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.filter((item) => item !== "all").map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
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
                Add
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card/70 p-5">
            <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Filters</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Select value={status} onValueChange={(value) => setStatus(value as (typeof statuses)[number])}>
                <SelectTrigger className="h-11 border-border/80 bg-background/70">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item === "all" ? "All statuses" : item.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={category} onValueChange={(value) => setCategory(value as (typeof categories)[number])}>
                <SelectTrigger className="h-11 border-border/80 bg-background/70">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item === "all" ? "All categories" : item}
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
          <p className="section-label">Task list</p>
          <h3 className="mt-2 font-heading text-3xl text-foreground">Execution board</h3>
        </div>

        <div>
          {tasksQuery.isPending && !tasks.length && (
            <div className="px-6 py-6">
              <PageStatusPanel
                eyebrow="Task sync"
                title="Loading your mission list."
                description="Tasks, statuses, and filters are being restored."
                loading
              />
            </div>
          )}

          {tasksQuery.isError && (
            <div className="px-6 py-6">
              <PageStatusPanel
                eyebrow="Task fallback"
                title="Task data could not be loaded."
                description="The board stayed visible with safe defaults. Retry to fetch your latest tasks."
                actionLabel="Retry"
                onAction={() => void tasksQuery.refetch()}
                tone="danger"
              />
            </div>
          )}

          {tasks.map((task: Task) => (
            <div key={task.id} className="mission-row flex items-center gap-4 border-b border-border/60 px-6 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-base font-medium text-foreground">{task.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {task.category} / {formatHoursFromMinutes(task.estimatedMinutes)} / {task.referenceLabel || task.weakArea || "Focus"}
                  {task.dueAt ? ` / Due ${formatTaskDueLabel(task.dueAt)}` : ""}
                </p>
              </div>

              <TaskStatusControl
                status={task.status}
                disabled={updateMutation.isPending && updateMutation.variables?.taskId === task.id}
                compact
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
                Delete
              </Button>
            </div>
          ))}

          {!tasks.length && !tasksQuery.isPending && (
            <div className="px-6 py-10 text-center">
              <p className="font-heading text-3xl text-foreground">
                {tasksQuery.isError ? "No tasks are available right now." : "No tasks match these filters."}
              </p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {tasksQuery.isError
                  ? "Retry the request, or create a task manually while the API reconnects."
                  : "Generate from Prep Architect or create one manually here."}
              </p>
            </div>
          )}
        </div>
      </section>

      {shouldShowStudentPanels && <StudentPracticeCapsulesPanel />}

      {shouldShowStudentPanels && <WorkProofPanel />}
    </div>
  );
}
