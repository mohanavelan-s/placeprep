import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, PencilLine, RefreshCcw, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import HoursInput from "@/components/HoursInput";
import PrepPlanView from "@/components/PrepPlanView";
import SoftSyncNotice from "@/components/SoftSyncNotice";
import TopicTagInput from "@/components/TopicTagInput";
import { PrepArchitectSkeleton } from "@/components/WorkspaceSkeletons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTierGate } from "@/hooks/use-tier-gate";
import {
  activatePrepPlan,
  clearPrepPlanHistory,
  fetchLatestPrepPlan,
  fetchPrepPlanHistory,
  generatePrepPlan,
  renamePrepPlan,
  type PrepPlan,
  updatePrepPlan,
} from "@/lib/api";
import { useQueryErrorLogger } from "@/hooks/use-query-error-logger";
import { hoursStringFromMinutes, parseHoursToMinutes } from "@/lib/time";
import { PREP_LANGUAGES, PREP_TOPICS, TARGET_ROLES } from "@/lib/topics";

export default function PrepArchitectPage() {
  const queryClient = useQueryClient();
  const { user, refreshProfile } = useAuth();
  const tierGate = useTierGate();
  const { language } = useLanguage();
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
  const [durationMonths, setDurationMonths] = useState("1");
  const [targetRole, setTargetRole] = useState(user?.targetRole || "Backend Engineer");
  const [preferredLanguage, setPreferredLanguage] = useState(language);
  const [isEditing, setIsEditing] = useState(false);
  const [manageVersionsOpen, setManageVersionsOpen] = useState(false);
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [planToRename, setPlanToRename] = useState<PrepPlan | null>(null);
  const [renameTitle, setRenameTitle] = useState("");

  useEffect(() => {
    if (!latestPlanQuery.data) {
      setKnownTopics(user?.strongTopics || []);
      setTargetTopics(user?.weakAreas || []);
      setTargetRole(user?.targetRole || "Backend Engineer");
      setTimePerDayHours("2");
      setDurationMonths("1");
      setPreferredLanguage(language);
      return;
    }

    setKnownTopics(latestPlanQuery.data.knownTopics || []);
    setTargetTopics(latestPlanQuery.data.targetTopics || []);
    setTimePerDayHours(hoursStringFromMinutes(latestPlanQuery.data.timePerDay || 120));
    setDurationMonths(String(latestPlanQuery.data.durationMonths || 1));
    setTargetRole(latestPlanQuery.data.targetRole || user?.targetRole || "Backend Engineer");
    setPreferredLanguage(latestPlanQuery.data.preferredLanguage || "english");
  }, [language, latestPlanQuery.data, user?.strongTopics, user?.targetRole, user?.weakAreas]);

  const generateMutation = useMutation({
    mutationFn: () =>
      generatePrepPlan({
        knownTopics,
        targetTopics,
        timePerDay: parseHoursToMinutes(timePerDayHours, 120),
        durationMonths: Math.min(12, Math.max(1, Number(durationMonths || 1))),
        targetRole,
        preferredLanguage,
      }),
    onSuccess: async (result) => {
      queryClient.setQueryData(["prep-plan", "latest"], result);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["prep-plan", "history"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["progress-summary"] }),
        refreshProfile(),
      ]);
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
        durationMonths: Math.min(12, Math.max(1, Number(durationMonths || 1))),
        targetRole,
        preferredLanguage,
      }),
    onSuccess: async (result) => {
      queryClient.setQueryData(["prep-plan", "latest"], result);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["prep-plan", "history"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["progress-summary"] }),
        refreshProfile(),
      ]);
      setIsEditing(false);
      toast.success("Prep Architect plan updated.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to update the plan.");
    },
  });

  const activateVersionMutation = useMutation({
    mutationFn: (planId: string) => activatePrepPlan(planId),
    onSuccess: async (result) => {
      queryClient.setQueryData(["prep-plan", "latest"], result);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["prep-plan", "history"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks", "today"] }),
        queryClient.invalidateQueries({ queryKey: ["progress-summary"] }),
      ]);
      setIsEditing(false);
      toast.success(`Switched to ${result.title || `Prep Architect v${result.version}`}.`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to switch plan version.");
    },
  });

  const renamePlanMutation = useMutation({
    mutationFn: ({ planId, title }: { planId: string; title: string }) =>
      renamePrepPlan({ planId, title }),
    onSuccess: async (result) => {
      if (latestPlanQuery.data?.id === result.id) {
        queryClient.setQueryData(["prep-plan", "latest"], result);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["prep-plan", "history"] }),
        queryClient.invalidateQueries({ queryKey: ["prep-plan", "latest"] }),
      ]);

      setRenameDialogOpen(false);
      setPlanToRename(null);
      setRenameTitle("");
      toast.success(`Renamed plan to ${result.title || "your new title"}.`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to rename this plan.");
    },
  });

  const deleteVersionsMutation = useMutation({
    mutationFn: (planIds: string[]) => clearPrepPlanHistory(planIds),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["prep-plan", "latest"] }),
        queryClient.invalidateQueries({ queryKey: ["prep-plan", "history"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks", "today"] }),
        queryClient.invalidateQueries({ queryKey: ["progress-summary"] }),
      ]);
      setSelectedPlanIds([]);
      setManageVersionsOpen(false);
      setIsEditing(false);
      toast.success(
        result.deleted
          ? `Removed ${result.deleted} Prep Architect version${result.deleted === 1 ? "" : "s"}.`
          : "No Prep Architect versions were removed.",
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to delete selected plan versions.");
    },
  });

  const pending = generateMutation.isPending || updateMutation.isPending;
  const canGeneratePlan = tierGate.canUse("plan_generations");
  const latestPlan = latestPlanQuery.data ?? null;
  const history = useMemo(
    () => (Array.isArray(historyQuery.data) ? historyQuery.data : []),
    [historyQuery.data],
  );

  useEffect(() => {
    setSelectedPlanIds((current) => current.filter((planId) => history.some((plan) => plan.id === planId)));
  }, [history]);

  const allVersionsSelected = history.length > 0 && selectedPlanIds.length === history.length;
  const roleStrategyCopy = useMemo(() => {
    if (/data analyst/i.test(targetRole)) {
      return "Data Analyst plans bias toward SQL, statistics, dashboards, and stakeholder-ready analysis work while still honoring the topics you selected.";
    }

    if (/data engineer/i.test(targetRole)) {
      return "Data Engineer plans bias toward SQL, pipelines, warehousing, orchestration, and build-oriented project work alongside your selected topics.";
    }

    if (/data scientist/i.test(targetRole)) {
      return "Data Scientist plans bias toward Python, statistics, machine learning, and experiment-driven portfolio work while keeping your selected topics in focus.";
    }

    return "Plans bias toward the selected role while still prioritizing the topics you added above.";
  }, [targetRole]);

  function toggleSelectedPlan(planId: string, checked: boolean | "indeterminate") {
    setSelectedPlanIds((current) => {
      if (checked) {
        return current.includes(planId) ? current : [...current, planId];
      }

      return current.filter((id) => id !== planId);
    });
  }

  function toggleSelectAllVersions() {
    setSelectedPlanIds(allVersionsSelected ? [] : history.map((plan) => plan.id));
  }

  function openRenameDialog(plan: PrepPlan) {
    setPlanToRename(plan);
    setRenameTitle(plan.title || "");
    setRenameDialogOpen(true);
  }

  if (latestPlanQuery.isPending && !latestPlan) {
    return <PrepArchitectSkeleton />;
  }

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
              Select your current strengths, your target topics, your daily time budget, the number of months you want the plan to span, and the role you are pushing toward. PlacePrep will turn it into a roadmap, a task system, resources, and flashcards you can keep editing.
            </p>
          </div>

          {latestPlan && (
            <div className="rounded-2xl border border-border/80 bg-background/40 px-4 py-3 text-sm text-foreground/80">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Active plan</p>
                  <p className="mt-2 font-heading text-2xl text-foreground">
                    {latestPlan.title || `Version ${latestPlan.version}`}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    v{latestPlan.version} / {latestPlan.durationMonths} month{latestPlan.durationMonths === 1 ? "" : "s"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {latestPlan.targetTopics[0] || "Custom focus"} / {latestPlan.preferredLanguage || "english"}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-muted-foreground"
                  onClick={() => openRenameDialog(latestPlan)}
                  aria-label="Rename active plan"
                >
                  <PencilLine className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {latestPlanQuery.isError && (
        <SoftSyncNotice
          title="Prep Architect is temporarily running without live sync."
          description="You can still edit topics and build a new plan. Retry if you want stored plans and version history back."
          actionLabel="Retry"
          onAction={() => {
            void latestPlanQuery.refetch();
            void historyQuery.refetch();
          }}
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
              <Button type="button" className="gap-2" onClick={() => generateMutation.mutate()} disabled={pending || !canGeneratePlan}>
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
                <Button type="button" className="gap-2" onClick={() => updateMutation.mutate()} disabled={pending || !canGeneratePlan}>
                  <RefreshCcw className="h-4 w-4" />
                  {pending ? "Building your plan..." : "Regenerate Plan"}
                </Button>
              </>
            )}
            {latestPlan && isEditing && (
              <Button type="button" className="gap-2" onClick={() => updateMutation.mutate()} disabled={pending || !canGeneratePlan}>
                <RefreshCcw className="h-4 w-4" />
                {pending ? "Building your plan..." : "Update Plan"}
              </Button>
            )}
          </div>
        </div>

        {!canGeneratePlan && tierGate.tier === "free" && (
          <div className="mb-6 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm leading-6 text-foreground/85">
            Free workspaces include one AI-generated plan. Enter a college invite or upgrade later to regenerate more plans.
          </div>
        )}

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
              <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Plan duration</p>
              <Input
                type="number"
                min={1}
                max={12}
                step={1}
                inputMode="numeric"
                value={durationMonths}
                onChange={(event) => setDurationMonths(event.target.value)}
                placeholder="3 months"
                className="mt-3 h-11 border-border/80 bg-background/70"
              />
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Choose how many months the roadmap should cover. PlacePrep will stretch the weekly plan across this full window.
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
                {roleStrategyCopy}
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card/70 p-5">
              <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Plan language</p>
              <Select value={preferredLanguage} onValueChange={setPreferredLanguage}>
                <SelectTrigger className="mt-3 h-11 border-border/80 bg-background/70">
                  <SelectValue placeholder="Choose a language" />
                </SelectTrigger>
                <SelectContent>
                  {PREP_LANGUAGES.map((language) => (
                    <SelectItem key={language.value} value={language.value}>
                      {language.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Video resources lean into this language. Tamil plans prefer channels like Error Makes Clever, Hindi plans prefer Hindi-first explainers, and readable links open through translation when needed.
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card/70 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Version history</p>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 gap-2 border-border/80 bg-background/70"
                  disabled={!history.length}
                  onClick={() => setManageVersionsOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  Clear
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                {historyQuery.isError && (
                  <SoftSyncNotice
                    title="Saved plan history is temporarily unavailable."
                    description="You can still build, edit, and regenerate the active plan. Retry when you want older versions back."
                    actionLabel="Retry"
                    onAction={() => void historyQuery.refetch()}
                  />
                )}

                {history.length ? history.map((plan) => (
                  <div key={plan.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/40 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">{plan.title || `Version ${plan.version}`}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        v{plan.version} / {plan.durationMonths} month{plan.durationMonths === 1 ? "" : "s"} /{" "}
                        {new Date(plan.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-muted-foreground"
                        onClick={() => openRenameDialog(plan)}
                        aria-label={`Rename ${plan.title || `version ${plan.version}`}`}
                      >
                        <PencilLine className="h-4 w-4" />
                      </Button>
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        <History className="h-4 w-4" />
                        {plan.isActive ? "Active" : "Saved"}
                      </div>
                      {!plan.isActive && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 border-border/80 bg-background/70"
                          disabled={activateVersionMutation.isPending}
                          onClick={() => activateVersionMutation.mutate(plan.id)}
                        >
                          {activateVersionMutation.isPending && activateVersionMutation.variables === plan.id
                            ? "Switching..."
                            : "Use version"}
                        </Button>
                      )}
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

      <Dialog
        open={renameDialogOpen}
        onOpenChange={(open) => {
          setRenameDialogOpen(open);
          if (!open) {
            setPlanToRename(null);
            setRenameTitle("");
          }
        }}
      >
        <DialogContent className="border-border/80 bg-card text-foreground sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Rename plan</DialogTitle>
            <DialogDescription>
              Give this Prep Architect version a name that matches its focus. If you skip this, the system will keep using an automatic title.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              value={renameTitle}
              onChange={(event) => setRenameTitle(event.target.value)}
              placeholder={planToRename?.title || "Operating Systems + DSA Focus Plan"}
              maxLength={80}
              className="h-11 border-border/80 bg-background/70"
            />
            {planToRename && (
              <p className="text-sm leading-6 text-muted-foreground">
                Renaming v{planToRename.version}. Your tasks and history stay the same.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setRenameDialogOpen(false);
                setPlanToRename(null);
                setRenameTitle("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!planToRename || renameTitle.trim().length < 2 || renamePlanMutation.isPending}
              onClick={() => {
                if (!planToRename) {
                  return;
                }

                renamePlanMutation.mutate({
                  planId: planToRename.id,
                  title: renameTitle.trim(),
                });
              }}
            >
              {renamePlanMutation.isPending ? "Saving..." : "Save name"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manageVersionsOpen} onOpenChange={setManageVersionsOpen}>
        <DialogContent className="border-border/80 bg-card text-foreground sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Select versions to remove</DialogTitle>
            <DialogDescription>
              Pick the saved Prep Architect versions you want to delete. If you delete the active version, the latest remaining version becomes active automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Button
              type="button"
              variant="ghost"
              className="h-9 px-0 text-sm text-muted-foreground hover:bg-transparent hover:text-foreground"
              onClick={toggleSelectAllVersions}
            >
              {allVersionsSelected ? "Clear selection" : "Select all versions"}
            </Button>

            <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {history.map((plan) => (
                <label
                  key={`delete-${plan.id}`}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 bg-background/40 px-4 py-3"
                >
                  <Checkbox
                    checked={selectedPlanIds.includes(plan.id)}
                    onCheckedChange={(checked) => toggleSelectedPlan(plan.id, checked)}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm text-foreground">{plan.title || `Version ${plan.version}`}</p>
                      {plan.isActive && (
                        <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.16em] text-primary/90">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      v{plan.version} / {plan.durationMonths} month{plan.durationMonths === 1 ? "" : "s"} /{" "}
                      {new Date(plan.createdAt).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="mt-2 text-sm text-foreground/75">
                      {(plan.targetTopics || []).slice(0, 3).join(" / ") || plan.targetRole || "Saved version"}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => setManageVersionsOpen(false)}>
              Cancel
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={!selectedPlanIds.length || deleteVersionsMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                  {deleteVersionsMutation.isPending ? "Deleting..." : "Delete selected"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="border-border/80 bg-card text-foreground">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete selected plan versions?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the selected Prep Architect versions and their linked task history from your account.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => deleteVersionsMutation.mutate(selectedPlanIds)}
                  >
                    Delete versions
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
