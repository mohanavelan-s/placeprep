import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, PencilLine, RefreshCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import ClearHistoryButton from "@/components/ClearHistoryButton";
import HoursInput from "@/components/HoursInput";
import PageStatusPanel from "@/components/PageStatusPanel";
import PrepPlanView from "@/components/PrepPlanView";
import TopicTagInput from "@/components/TopicTagInput";
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
import {
  clearPrepPlanHistory,
  fetchLatestPrepPlan,
  fetchPrepPlanHistory,
  generatePrepPlan,
  updatePrepPlan,
} from "@/lib/api";
import { useQueryErrorLogger } from "@/hooks/use-query-error-logger";
import { hoursStringFromMinutes, parseHoursToMinutes } from "@/lib/time";
import { PREP_TOPICS, TARGET_ROLES } from "@/lib/topics";

export default function PrepArchitectPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const latestPlanQuery = useQuery({
    queryKey: ["prep-plan", "latest"],
    queryFn: fetchLatestPrepPlan,
  });
  const historyQuery = useQuery({
    queryKey: ["prep-plan", "history"],
    queryFn: () => fetchPrepPlanHistory(8),
  });

  useQueryErrorLogger("PrepArchitectPage:latest-plan", latestPlanQuery.error);
  useQueryErrorLogger("PrepArchitectPage:history", historyQuery.error);

  const [knownTopics, setKnownTopics] = useState<string[]>([]);
  const [targetTopics, setTargetTopics] = useState<string[]>([]);
  const [timePerDayHours, setTimePerDayHours] = useState("2");
  const [targetRole, setTargetRole] = useState(user?.targetRole || "Backend Engineer");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!latestPlanQuery.data) {
      setKnownTopics(user?.strongTopics || []);
      setTargetTopics(user?.weakAreas || []);
      setTargetRole(user?.targetRole || "Backend Engineer");
      setTimePerDayHours("2");
      return;
    }

    setKnownTopics(latestPlanQuery.data.knownTopics || []);
    setTargetTopics(latestPlanQuery.data.targetTopics || []);
    setTimePerDayHours(hoursStringFromMinutes(latestPlanQuery.data.timePerDay || 120));
    setTargetRole(latestPlanQuery.data.targetRole || user?.targetRole || "Backend Engineer");
  }, [latestPlanQuery.data, user?.strongTopics, user?.targetRole, user?.weakAreas]);

  const generateMutation = useMutation({
    mutationFn: () =>
      generatePrepPlan({
        knownTopics,
        targetTopics,
        timePerDay: parseHoursToMinutes(timePerDayHours, 120),
        targetRole,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(["prep-plan", "latest"], result);
      void queryClient.invalidateQueries({ queryKey: ["prep-plan", "history"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["progress-summary"] });
      setIsEditing(false);
      toast.success("Prep Architect plan generated.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to build the plan.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      updatePrepPlan({
        planId: latestPlanQuery.data?.id || "",
        knownTopics,
        targetTopics,
        timePerDay: parseHoursToMinutes(timePerDayHours, 120),
        targetRole,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(["prep-plan", "latest"], result);
      void queryClient.invalidateQueries({ queryKey: ["prep-plan", "history"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["progress-summary"] });
      setIsEditing(false);
      toast.success("Prep Architect plan updated.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to update the plan.");
    },
  });

  const clearHistoryMutation = useMutation({
    mutationFn: clearPrepPlanHistory,
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["prep-plan", "latest"] }),
        queryClient.invalidateQueries({ queryKey: ["prep-plan", "history"] }),
      ]);
      setIsEditing(false);
      toast.success(
        result.deleted
          ? `Prep Architect history cleared from ${result.deleted} saved version${result.deleted === 1 ? "" : "s"}.`
          : "Prep Architect history was already empty.",
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to clear Prep Architect history.");
    },
  });

  const pending = generateMutation.isPending || updateMutation.isPending;
  const latestPlan = latestPlanQuery.data ?? null;
  const history = Array.isArray(historyQuery.data) ? historyQuery.data : [];

  return (
    <div className="grid gap-6">
      <section className="surface-panel-strong p-6 md:p-7">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="section-label">Prep Architect</p>
            <h2 className="mt-2 font-heading text-4xl text-foreground md:text-5xl">
              Build a learning engine around what you know and what you still need.
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-foreground/80">
              Select your current strengths, your target topics, your daily time budget, and the role you are pushing toward. PlacePrep will turn it into a roadmap, a task system, resources, and flashcards you can keep editing.
            </p>
          </div>

          {latestPlan && (
            <div className="rounded-2xl border border-border/80 bg-background/40 px-4 py-3 text-sm text-foreground/80">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Active plan</p>
              <p className="mt-2 font-heading text-3xl text-foreground">v{latestPlan.version}</p>
              <p className="mt-1 text-sm text-muted-foreground">{latestPlan.targetTopics[0] || "Custom focus"}</p>
            </div>
          )}
        </div>
      </section>

      {latestPlanQuery.isPending && !latestPlan && (
        <PageStatusPanel
          eyebrow="Architect sync"
          title="Loading your latest plan."
          description="Known topics, targets, and saved versions are being restored."
          loading
        />
      )}

      {(latestPlanQuery.isError || historyQuery.isError) && (
        <PageStatusPanel
          eyebrow="Architect fallback"
          title="Prep Architect is running in recovery mode."
          description="You can still edit topics and build a new plan. Retry if you want stored plans and version history back."
          actionLabel="Retry"
          onAction={() => {
            void latestPlanQuery.refetch();
            void historyQuery.refetch();
          }}
          tone="danger"
        />
      )}

      <section className="surface-panel p-6 md:p-7">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="section-label">Input system</p>
            <h3 className="mt-2 font-heading text-3xl text-foreground">Editable, tag-based planning</h3>
          </div>

          <div className="flex flex-wrap gap-3">
            {!latestPlan && (
              <Button type="button" className="gap-2" onClick={() => generateMutation.mutate()} disabled={pending}>
                <Sparkles className="h-4 w-4" />
                {pending ? "Building your plan..." : "Generate Plan"}
              </Button>
            )}
            {latestPlan && !isEditing && (
              <>
                <Button type="button" variant="outline" className="gap-2" onClick={() => setIsEditing(true)}>
                  <PencilLine className="h-4 w-4" />
                  Edit Plan
                </Button>
                <Button type="button" className="gap-2" onClick={() => updateMutation.mutate()} disabled={pending}>
                  <RefreshCcw className="h-4 w-4" />
                  {pending ? "Building your plan..." : "Regenerate Plan"}
                </Button>
              </>
            )}
            {latestPlan && isEditing && (
              <Button type="button" className="gap-2" onClick={() => updateMutation.mutate()} disabled={pending}>
                <RefreshCcw className="h-4 w-4" />
                {pending ? "Building your plan..." : "Update Plan"}
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-6">
            <TopicTagInput
              label="What do you know?"
              placeholder="Search or add known topics"
              value={knownTopics}
              onChange={setKnownTopics}
              suggestions={PREP_TOPICS}
              maxTags={8}
            />

            <TopicTagInput
              label="What do you want to learn?"
              placeholder="Search or add target topics"
              value={targetTopics}
              onChange={setTargetTopics}
              suggestions={PREP_TOPICS}
              maxTags={8}
            />
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border/80 bg-card/70 p-5">
              <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Time per day</p>
              <HoursInput
                min={1}
                max={8}
                value={timePerDayHours}
                onChange={(event) => setTimePerDayHours(event.target.value)}
                placeholder="2 hrs"
                className="mt-3 h-11 border-border/80 bg-background/70"
              />
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Keep it realistic. The system will distribute the workload across the week.
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card/70 p-5">
              <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Target role</p>
              <Select value={targetRole} onValueChange={setTargetRole}>
                <SelectTrigger className="mt-3 h-11 border-border/80 bg-background/70">
                  <SelectValue placeholder="Choose a role" />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Backend-oriented plans automatically bias toward DBMS, Operating Systems, and System Design.
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card/70 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Version history</p>
                <ClearHistoryButton
                  title="Clear Prep Architect history?"
                  description="This removes saved Prep Architect versions for this account. Your current editor inputs will stay available."
                  onConfirm={() => clearHistoryMutation.mutate()}
                  pending={clearHistoryMutation.isPending}
                  disabled={!history.length}
                  className="h-10 gap-2 border-border/80 bg-background/70"
                />
              </div>
              <div className="mt-4 space-y-3">
                {history.length ? history.map((plan) => (
                  <div key={plan.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/40 px-4 py-3">
                    <div>
                      <p className="text-sm text-foreground">Version {plan.version}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        {new Date(plan.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      <History className="h-4 w-4" />
                      {plan.isActive ? "Active" : "Saved"}
                    </div>
                  </div>
                )) : historyQuery.isPending ? (
                  <p className="text-sm leading-6 text-muted-foreground">
                    Restoring saved plan history.
                  </p>
                ) : (
                  <p className="text-sm leading-6 text-muted-foreground">
                    {historyQuery.isError
                      ? "Stored plan history is unavailable right now. Generate or update a plan and we will keep the editor active."
                      : "No stored plans yet. Generate one and we will keep version history from there."}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {pending && (
        <section className="surface-panel p-6 text-center">
          <p className="section-label">Building your plan...</p>
          <p className="mt-3 font-heading text-3xl text-foreground">
            Roadmap, tasks, resources, and flashcards are being assembled.
          </p>
        </section>
      )}

      {latestPlan && <PrepPlanView plan={latestPlan} />}
    </div>
  );
}
