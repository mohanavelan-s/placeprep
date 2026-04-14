import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, BookCopy, ClipboardCheck, Sparkles } from "lucide-react";

import PageStatusPanel from "@/components/PageStatusPanel";
import { Button } from "@/components/ui/button";
import { fetchTasks, type PracticeCapsule, type Task } from "@/lib/api";
import { useQueryErrorLogger } from "@/hooks/use-query-error-logger";

function buildPracticeCapsules(tasks: Task[]) {
  const grouped = new Map<string, PracticeCapsule>();

  for (const task of tasks) {
    const metadata = task.metadata || {};
    if (metadata.shareKind !== "admin-practice-link") {
      continue;
    }

    const bundleId = typeof metadata.bundleId === "string" ? metadata.bundleId : task.id;
    const bundle = grouped.get(bundleId) || {
      bundleId,
      title:
        typeof metadata.bundleTitle === "string" && metadata.bundleTitle.trim()
          ? metadata.bundleTitle
          : "Admin practice capsule",
      note: typeof metadata.bundleNote === "string" ? metadata.bundleNote : null,
      studentUserId: task.userId,
      assignedById: typeof metadata.assignedByAdminId === "string" ? metadata.assignedByAdminId : null,
      assignedByName: typeof metadata.assignedByAdminName === "string" ? metadata.assignedByAdminName : null,
      scheduledFor: task.scheduledFor,
      createdAt: task.createdAt,
      items: [],
    };

    bundle.items.push({
      taskId: task.id,
      title: task.title,
      category: task.category,
      status: task.status,
      referenceLabel: task.referenceLabel || null,
      referenceUrl: task.referenceUrl || null,
      capsuleType:
        typeof metadata.capsuleType === "string" ? metadata.capsuleType : "resource",
      scheduledFor: task.scheduledFor,
      createdAt: task.createdAt,
    });

    grouped.set(bundleId, bundle);
  }

  return Array.from(grouped.values())
    .map((bundle) => ({
      ...bundle,
      items: bundle.items.sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    }))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function formatCapsuleDate(value: string) {
  try {
    return new Date(value).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

export default function StudentPracticeCapsulesPanel() {
  const tasksQuery = useQuery({
    queryKey: ["tasks", "practice-capsules"],
    queryFn: () => fetchTasks(),
  });

  useQueryErrorLogger("StudentPracticeCapsulesPanel:tasks", tasksQuery.error);

  const capsules = useMemo(
    () => buildPracticeCapsules(Array.isArray(tasksQuery.data) ? tasksQuery.data : []),
    [tasksQuery.data],
  );

  if (!tasksQuery.isPending && !tasksQuery.isError && !capsules.length) {
    return null;
  }

  return (
    <section className="surface-panel p-6 md:p-7">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="section-label">Assigned by admin</p>
          <h3 className="mt-2 font-heading text-3xl text-foreground">
            Capsules shared into your queue.
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Open the exact LeetCode, verbal, and aptitude links the admin pushed for you, then clear them from the task board below as you finish.
          </p>
        </div>
        <div className="coach-chip border-primary/25 bg-primary/10 text-foreground">
          {capsules.length} active bundle{capsules.length === 1 ? "" : "s"}
        </div>
      </div>

      {tasksQuery.isPending && !capsules.length && (
        <PageStatusPanel
          eyebrow="Capsule sync"
          title="Loading admin assignments."
          description="Practice links shared by admins are being restored into your task space."
          loading
        />
      )}

      {tasksQuery.isError && (
        <PageStatusPanel
          eyebrow="Capsule fallback"
          title="Admin-shared links could not be loaded."
          description="Retry when you want the latest assigned practice bundle back in view."
          actionLabel="Retry"
          onAction={() => void tasksQuery.refetch()}
          tone="danger"
        />
      )}

      <div className="grid gap-4">
        {capsules.map((capsule) => {
          const completed = capsule.items.filter((item) => item.status === "completed").length;

          return (
            <article
              key={capsule.bundleId}
              className="rounded-[1.35rem] border border-border/80 bg-card/65 p-5"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base text-foreground">{capsule.title}</p>
                    <span className="coach-chip border-primary/20 bg-background/50">
                      {completed}/{capsule.items.length} cleared
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Shared by {capsule.assignedByName || "admin"} for {formatCapsuleDate(capsule.scheduledFor)}.
                  </p>
                  {capsule.note && (
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/80">{capsule.note}</p>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {capsule.items.map((item) => (
                  <div
                    key={item.taskId}
                    className="rounded-[1.15rem] border border-border/80 bg-background/45 px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="inline-flex items-center gap-2 text-foreground">
                          {item.capsuleType.startsWith("leetcode") ? (
                            <Sparkles className="h-4 w-4 text-primary" />
                          ) : item.capsuleType === "verbal" ? (
                            <BookCopy className="h-4 w-4 text-primary" />
                          ) : (
                            <ClipboardCheck className="h-4 w-4 text-primary" />
                          )}
                          <p className="text-sm">{item.title}</p>
                        </div>
                        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          {item.category} / {item.status.replace(/_/g, " ")}
                        </p>
                      </div>

                      {item.referenceUrl && (
                        <Button asChild variant="outline" className="h-9 gap-2 border-border/80 bg-card/60">
                          <a href={item.referenceUrl} target="_blank" rel="noreferrer">
                            Open
                            <ArrowUpRight className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>

                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {item.referenceLabel || "Open the assigned practice link and finish it through the task board."}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
