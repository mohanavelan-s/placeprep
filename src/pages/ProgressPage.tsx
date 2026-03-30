import { useQuery } from "@tanstack/react-query";

import DashboardProgressCharts from "@/components/DashboardProgressCharts";
import PageStatusPanel from "@/components/PageStatusPanel";
import StatsGrid from "@/components/StatsGrid";
import XPBar from "@/components/XPBar";
import { useQueryErrorLogger } from "@/hooks/use-query-error-logger";
import { fetchProgressHistory, fetchProgressSummary } from "@/lib/api";

export default function ProgressPage() {
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

  const summary = summaryQuery.data ?? null;
  const history = Array.isArray(historyQuery.data) ? historyQuery.data : [];
  const isBooting = (summaryQuery.isPending && !summary) || (historyQuery.isPending && !history.length);
  const hasError = summaryQuery.isError || historyQuery.isError;

  function handleRetry() {
    void summaryQuery.refetch();
    void historyQuery.refetch();
  }

  return (
    <div className="grid gap-6">
      <section className="surface-panel-strong p-6 md:p-7">
        <p className="section-label">Progress</p>
        <h2 className="mt-2 font-heading text-4xl text-foreground md:text-5xl">
          Track the trend, not just today's mood.
        </h2>
      </section>

      {isBooting && (
        <PageStatusPanel
          eyebrow="Progress sync"
          title="Loading readiness telemetry."
          description="PlacePrep is pulling your streaks, consistency, charts, and history."
          loading
        />
      )}

      {hasError && (
        <PageStatusPanel
          eyebrow="Progress fallback"
          title="Some progress data could not be loaded."
          description="The page is still usable with safe defaults. Retry to pull the latest analytics."
          actionLabel="Retry"
          onAction={handleRetry}
          tone="danger"
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
        <p className="section-label">History</p>
        <h3 className="mt-2 font-heading text-3xl text-foreground">Daily snapshots</h3>
        <div className="mt-6 space-y-3">
          {history.map((entry) => (
            <div key={entry.id} className="rounded-2xl border border-border/80 bg-card/70 p-4">
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
          ))}
          {!history.length && !historyQuery.isPending && (
            <div className="rounded-2xl border border-border/80 bg-card/70 p-5 text-sm leading-6 text-muted-foreground">
              No daily snapshots yet. Once you log work, streak and consistency history will accumulate here.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
