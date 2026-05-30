import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import ClearHistoryButton from "@/components/ClearHistoryButton";
import DashboardProgressCharts from "@/components/DashboardProgressCharts";
import SoftSyncNotice from "@/components/SoftSyncNotice";
import StatsGrid from "@/components/StatsGrid";
import { ProgressSkeleton } from "@/components/WorkspaceSkeletons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import XPBar from "@/components/XPBar";
import { useQueryErrorLogger } from "@/hooks/use-query-error-logger";
import { clearProgressHistory, fetchProgressHistory, fetchProgressSummary } from "@/lib/api";

export default function ProgressPage() {
  const queryClient = useQueryClient();
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);
  const summaryQuery = useQuery({
    queryKey: ["progress-summary"],
    queryFn: fetchProgressSummary,
  });
  const historyQuery = useQuery({
    queryKey: ["progress-history"],
    queryFn: () => fetchProgressHistory(21),
  });

  useQueryErrorLogger("ProgressPage:summary", summaryQuery.error);
  useQueryErrorLogger("ProgressPage:history", historyQuery.error);

  const clearHistoryMutation = useMutation({
    mutationFn: (entryIds?: string[]) => clearProgressHistory(entryIds),
    onSuccess: (result) => {
      if (selectedHistoryIds.length) {
        queryClient.setQueryData(["progress-history"], (current: typeof history | undefined) =>
          (current || []).filter((entry) => !selectedHistoryIds.includes(entry.id)),
        );
      } else {
        queryClient.setQueryData(["progress-history"], []);
      }
      setSelectedHistoryIds([]);
      toast.success(
        result.deleted
          ? `Progress history cleared from ${result.deleted} saved snapshot${result.deleted === 1 ? "" : "s"}.`
          : "Progress history was already empty.",
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to clear progress history.");
    },
  });

  const summary = summaryQuery.data ?? null;
  const history = useMemo(
    () => (Array.isArray(historyQuery.data) ? historyQuery.data : []),
    [historyQuery.data],
  );
  const isBooting = summaryQuery.isPending && !summary;
  const hasError = summaryQuery.isError;
  const hasHistorySyncIssue = historyQuery.isError;

  useEffect(() => {
    setSelectedHistoryIds((current) => current.filter((entryId) => history.some((entry) => entry.id === entryId)));
  }, [history]);

  const allHistorySelected = history.length > 0 && selectedHistoryIds.length === history.length;

  function toggleHistoryEntry(entryId: string, checked: boolean | "indeterminate") {
    setSelectedHistoryIds((current) => {
      if (checked) {
        return current.includes(entryId) ? current : [...current, entryId];
      }

      return current.filter((value) => value !== entryId);
    });
  }

  function handleRetry() {
    void summaryQuery.refetch();
    void historyQuery.refetch();
  }

  if (isBooting) {
    return <ProgressSkeleton />;
  }

  return (
    <div className="grid gap-6">
      <section className="surface-panel-strong p-6 md:p-7">
        <p className="section-label">Progress</p>
        <h2 className="mt-2 font-heading text-4xl text-foreground md:text-5xl">
          Track the trend, not just today's mood.
        </h2>
      </section>

      {hasError && (
        <SoftSyncNotice
          title="Some live progress data is temporarily unavailable."
          description="The page is still usable with safe defaults. Retry to pull the latest analytics."
          actionLabel="Retry"
          onAction={handleRetry}
        />
      )}

      <StatsGrid
        metrics={[
          {
            label: "Streak",
            value: `${summary?.streak ?? 0}d`,
            helper: "Consecutive active days across logs, completed tasks, and sessions.",
          },
          {
            label: "Consistency",
            value: `${Math.round(summary?.consistencyScore ?? 0)}%`,
            helper: "How often you show up within the last two weeks.",
          },
          {
            label: "Readiness",
            value: `${Math.round(summary?.readinessScore ?? 0)}%`,
            helper: "Blend of execution, quality, and sustained coverage.",
          },
          {
            label: "Hours Logged",
            value: `${Number(summary?.totalHoursLogged ?? 0).toFixed(1)}h`,
            helper: "Study time plus Power Pocket minutes translated into hours.",
          },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[0.84fr_1.16fr]">
        <XPBar
          streak={summary?.streak ?? 0}
          missionsCompleted={summary?.missionsCompleted ?? 0}
        />
        <DashboardProgressCharts
          weeklyProgress={summary?.weeklyProgress ?? []}
          topicStrength={summary?.topicStrength ?? []}
        />
      </div>

      <section className="surface-panel p-6 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="section-label">History</p>
            <h3 className="mt-2 font-heading text-3xl text-foreground">Daily snapshots</h3>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2 border-border/80 bg-background/70"
              disabled={!history.length}
              onClick={() => setSelectedHistoryIds(allHistorySelected ? [] : history.map((entry) => entry.id))}
            >
              {allHistorySelected ? "Clear selection" : "Select all"}
            </Button>

            <ClearHistoryButton
              title="Clear selected snapshots?"
              description="This removes only the selected daily snapshot rows for this account."
              onConfirm={() => clearHistoryMutation.mutate(selectedHistoryIds)}
              pending={clearHistoryMutation.isPending}
              disabled={!selectedHistoryIds.length}
              buttonLabel="Clear selected"
              confirmLabel="Clear selected"
              className="h-11 gap-2 border-border/80 bg-background/70"
            />

            <ClearHistoryButton
              title="Clear all progress history?"
              description="This removes every saved progress snapshot row for this account. Fresh activity can create new snapshots later."
              onConfirm={() => clearHistoryMutation.mutate()}
              pending={clearHistoryMutation.isPending}
              disabled={!history.length}
              buttonLabel="Clear all"
              confirmLabel="Clear all"
              className="h-11 gap-2 border-border/80 bg-background/70"
            />
          </div>
        </div>
        <div className="mt-6 space-y-3">
          {hasHistorySyncIssue && (
            <SoftSyncNotice
              title="Saved progress history is temporarily unavailable."
              description="Your latest readiness metrics are still visible. Retry when you want the recent snapshot list back."
              actionLabel="Retry"
              onAction={() => void historyQuery.refetch()}
            />
          )}

          {history.map((entry) => (
            <div key={entry.id} className="rounded-2xl border border-border/80 bg-card/70 p-4">
              <div className="flex gap-3">
                <Checkbox
                  checked={selectedHistoryIds.includes(entry.id)}
                  onCheckedChange={(checked) => toggleHistoryEntry(entry.id, checked)}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {new Date(entry.statDate).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-foreground/80">
                        Execution {Math.round(Number(entry.executionRate) || 0)}% / Readiness {Math.round(Number(entry.readinessScore) || 0)}% / Consistency {Math.round(Number(entry.consistencyScore) || 0)}%
                      </p>
                    </div>
                    <p className="text-sm uppercase tracking-[0.16em] text-muted-foreground">
                      {entry.tasksCompleted} tasks / {Number(entry.totalHours || 0).toFixed(1)}h
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {!history.length && !historyQuery.isPending && !historyQuery.isError && (
            <div className="rounded-2xl border border-border/80 bg-card/70 p-5 text-sm leading-6 text-muted-foreground">
              No daily snapshots yet. Once you log work, streak and consistency history will accumulate here.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
