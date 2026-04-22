import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, BookCopy, ClipboardCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

import PageStatusPanel from "@/components/PageStatusPanel";
import TaskStatusControl from "@/components/TaskStatusControl";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";
import { fetchTasks, type PracticeCapsule, type Task, type TaskStatus, updateTask } from "@/lib/api";
import { allowsManualCompletion, getTaskVerificationHint } from "@/lib/task-verification";
import { useQueryErrorLogger } from "@/hooks/use-query-error-logger";
import type { UiLanguage } from "@/lib/ui-language";

type PracticeCapsuleTaskItem = PracticeCapsule["items"][number] & {
  sourceTask: Task;
};

type PracticeCapsuleWithTasks = Omit<PracticeCapsule, "items"> & {
  items: PracticeCapsuleTaskItem[];
};

const CAPSULE_TRANSLATIONS: Record<string, Record<Exclude<UiLanguage, "english">, string>> = {
  "Assigned by admin": {
    tamil: "நிர்வாகி வழங்கியது",
    hindi: "एडमिन द्वारा सौंपा गया",
  },
  "Bundles shared into your queue.": {
    tamil: "உங்கள் வரிசையில் பகிரப்பட்ட தொகுப்புகள்.",
    hindi: "आपकी कतार में साझा किए गए बंडल।",
  },
  "Open the exact tasks an admin pushed for you, follow any description they left, and clear them from the board below as you finish.": {
    tamil: "நிர்வாகி உங்களுக்காக பகிர்ந்த பணிகளைத் திறந்து, அவர் விட்ட குறிப்பைப் பின்பற்றி, முடிந்தபின் கீழே உள்ள பலகையில் அவற்றை முடிக்கவும்.",
    hindi: "एडमिन द्वारा भेजे गए टास्क खोलें, उनके दिए गए विवरण का पालन करें, और पूरा होने पर नीचे के बोर्ड से उन्हें साफ़ करें।",
  },
  "active bundle": {
    tamil: "செயலில் உள்ள தொகுப்பு",
    hindi: "सक्रिय बंडल",
  },
  "active bundles": {
    tamil: "செயலில் உள்ள தொகுப்புகள்",
    hindi: "सक्रिय बंडल",
  },
  "Capsule sync": {
    tamil: "தொகுப்பு ஒத்திசைவு",
    hindi: "कैप्सूल सिंक",
  },
  "Loading admin assignments.": {
    tamil: "நிர்வாகி பணிகள் ஏற்றப்படுகின்றன.",
    hindi: "एडमिन असाइनमेंट लोड हो रहे हैं।",
  },
  "Practice links shared by admins are being restored into your task space.": {
    tamil: "நிர்வாகிகள் பகிர்ந்த பயிற்சி இணைப்புகள் உங்கள் பணி இடத்திற்கு மீட்டெடுக்கப்படுகின்றன.",
    hindi: "एडमिन द्वारा साझा किए गए अभ्यास लिंक आपके टास्क स्पेस में बहाल किए जा रहे हैं।",
  },
  "Capsule fallback": {
    tamil: "தொகுப்பு மாற்று நிலை",
    hindi: "कैप्सूल फॉलबैक",
  },
  "Admin-shared links could not be loaded.": {
    tamil: "நிர்வாகி பகிர்ந்த இணைப்புகளை ஏற்ற முடியவில்லை.",
    hindi: "एडमिन द्वारा साझा किए गए लिंक लोड नहीं हो सके।",
  },
  "Retry when you want the latest assigned practice bundle back in view.": {
    tamil: "சமீபத்திய பயிற்சி தொகுப்பை மீண்டும் பார்க்க வேண்டுமெனில் மீண்டும் முயலுங்கள்.",
    hindi: "जब नवीनतम अभ्यास बंडल फिर से देखना हो, तब पुनः प्रयास करें।",
  },
  Retry: {
    tamil: "மீண்டும் முயலுங்கள்",
    hindi: "फिर से कोशिश करें",
  },
  cleared: {
    tamil: "முடிந்தது",
    hindi: "साफ़",
  },
  "Shared by": {
    tamil: "பகிர்ந்தவர்",
    hindi: "साझा किया",
  },
  admin: {
    tamil: "நிர்வாகி",
    hindi: "एडमिन",
  },
  "and due by": {
    tamil: "முடிவு தேதி",
    hindi: "और देय तिथि",
  },
  Open: {
    tamil: "திற",
    hindi: "खोलें",
  },
  "Open the assigned task link and finish it through the task board.": {
    tamil: "ஒதுக்கப்பட்ட பணி இணைப்பைத் திறந்து, பணி பலகையின் மூலம் அதை முடிக்கவும்.",
    hindi: "दिए गए टास्क लिंक को खोलें और उसे टास्क बोर्ड के माध्यम से पूरा करें।",
  },
  "Auto-checks against the saved LeetCode profile. You can also upload proof for this task.": {
    tamil: "சேமிக்கப்பட்ட LeetCode சுயவிவரத்துடன் தானாகச் சரிபார்க்கும். இந்த பணிக்காக ஆதாரமும் பதிவேற்றலாம்.",
    hindi: "सेव किए गए LeetCode प्रोफ़ाइल से अपने आप जाँच करता है। आप इस टास्क के लिए प्रमाण भी अपलोड कर सकते हैं।",
  },
  "Upload linked proof and PlacePrep will verify it before marking this complete.": {
    tamil: "இணைக்கப்பட்ட ஆதாரத்தை பதிவேற்றுங்கள்; இதை முடிந்ததாக குறிக்கும் முன் PlacePrep சரிபார்க்கும்.",
    hindi: "जुड़ा हुआ प्रमाण अपलोड करें और PlacePrep इसे पूर्ण चिह्नित करने से पहले सत्यापित करेगा।",
  },
  "Admin assignment bundle": {
    tamil: "நிர்வாகி ஒதுக்கிய தொகுப்பு",
    hindi: "एडमिन असाइनमेंट बंडल",
  },
  Pending: {
    tamil: "நிலுவை",
    hindi: "लंबित",
  },
  "In progress": {
    tamil: "நடப்பில்",
    hindi: "प्रगति में",
  },
  Completed: {
    tamil: "முடிந்தது",
    hindi: "पूर्ण",
  },
  Skipped: {
    tamil: "தவிர்க்கப்பட்டது",
    hindi: "छोड़ा गया",
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
    hindi: "एप्टिट्यूड",
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
  "Unable to update task.": {
    tamil: "பணியை புதுப்பிக்க முடியவில்லை.",
    hindi: "टास्क अपडेट नहीं हो सका।",
  },
};

function toComparableTime(value?: string | null) {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function buildPracticeCapsules(tasks: Task[]) {
  const grouped = new Map<string, PracticeCapsuleWithTasks>();

  for (const task of tasks) {
    const metadata = task.metadata || {};
    if (metadata.shareKind !== "admin-practice-link" && metadata.shareKind !== "admin-assignment") {
      continue;
    }

    const bundleId = typeof metadata.bundleId === "string" ? metadata.bundleId : task.id;
    const bundle = grouped.get(bundleId) || {
      bundleId,
      title:
        typeof metadata.bundleTitle === "string" && metadata.bundleTitle.trim()
          ? metadata.bundleTitle
          : "Admin assignment bundle",
      note: typeof metadata.bundleNote === "string" ? metadata.bundleNote : null,
      studentUserId: task.userId,
      assignedById: typeof metadata.assignedByAdminId === "string" ? metadata.assignedByAdminId : null,
      assignedByName: typeof metadata.assignedByAdminName === "string" ? metadata.assignedByAdminName : null,
      dueAt: typeof task.dueAt === "string" ? task.dueAt : null,
      scheduledFor: task.scheduledFor,
      createdAt: task.createdAt,
      items: [],
    };

    bundle.items.push({
      taskId: task.id,
      title: task.title,
      description:
        typeof task.description === "string"
          ? task.description
          : typeof metadata.itemDescription === "string"
            ? metadata.itemDescription
            : null,
      category: task.category,
      status: task.status,
      referenceLabel: task.referenceLabel || null,
      referenceUrl: task.referenceUrl || null,
      capsuleType:
        typeof metadata.capsuleType === "string" ? metadata.capsuleType : "resource",
      dueAt: typeof task.dueAt === "string" ? task.dueAt : null,
      scheduledFor: task.scheduledFor,
      createdAt: task.createdAt,
      sourceTask: task,
    });

    grouped.set(bundleId, bundle);
  }

  return Array.from(grouped.values())
    .map((bundle) => ({
      ...bundle,
      items: bundle.items.sort((left, right) => toComparableTime(left.createdAt) - toComparableTime(right.createdAt)),
    }))
    .sort((left, right) => toComparableTime(right.createdAt) - toComparableTime(left.createdAt));
}

function formatCapsuleDate(value: string) {
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

export default function StudentPracticeCapsulesPanel() {
  const queryClient = useQueryClient();
  const { language, t } = useLanguage();
  const localize = (text: string) => CAPSULE_TRANSLATIONS[text]?.[language] || t(text);
  const localizeStatus = (value: TaskStatus) => {
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

  const tasksQuery = useQuery({
    queryKey: ["tasks", "practice-capsules"],
    queryFn: () => fetchTasks(),
  });

  useQueryErrorLogger("StudentPracticeCapsulesPanel:tasks", tasksQuery.error);

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      updateTask(taskId, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks", "today"] });
      void queryClient.invalidateQueries({ queryKey: ["progress-summary"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : localize("Unable to update task."));
    },
  });

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
          <p className="section-label">{localize("Assigned by admin")}</p>
          <h3 className="mt-2 font-heading text-3xl text-foreground">
            {localize("Bundles shared into your queue.")}
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            {localize("Open the exact tasks an admin pushed for you, follow any description they left, and clear them from the board below as you finish.")}
          </p>
        </div>
        <div className="coach-chip border-primary/25 bg-primary/10 text-foreground">
          {capsules.length} {capsules.length === 1 ? localize("active bundle") : localize("active bundles")}
        </div>
      </div>

      {tasksQuery.isPending && !capsules.length && (
        <PageStatusPanel
          eyebrow={localize("Capsule sync")}
          title={localize("Loading admin assignments.")}
          description={localize("Practice links shared by admins are being restored into your task space.")}
          loading
        />
      )}

      {tasksQuery.isError && (
        <PageStatusPanel
          eyebrow={localize("Capsule fallback")}
          title={localize("Admin-shared links could not be loaded.")}
          description={localize("Retry when you want the latest assigned practice bundle back in view.")}
          actionLabel={localize("Retry")}
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
                    <p className="text-base text-foreground">
                      {capsule.title === "Admin assignment bundle"
                        ? localize("Admin assignment bundle")
                        : capsule.title}
                    </p>
                    <span className="coach-chip border-primary/20 bg-background/50">
                      {completed}/{capsule.items.length} {localize("cleared")}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {localize("Shared by")} {capsule.assignedByName || localize("admin")} {localize("and due by")}{" "}
                    {formatCapsuleDate(capsule.dueAt || capsule.scheduledFor)}.
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
                          {localize(item.category)} / {localizeStatus(item.status)}
                        </p>
                      </div>

                      {item.referenceUrl && (
                        <Button asChild variant="outline" className="h-9 gap-2 border-border/80 bg-card/60">
                          <a href={item.referenceUrl} target="_blank" rel="noreferrer">
                            {localize("Open")}
                            <ArrowUpRight className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>

                    {item.description && (
                      <p className="mt-3 text-sm leading-6 text-foreground/80">{item.description}</p>
                    )}

                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {item.referenceLabel || localize("Open the assigned task link and finish it through the task board.")}
                    </p>
                    {getTaskVerificationHint(item.sourceTask) && (
                      <p className="mt-3 text-xs uppercase tracking-[0.14em] text-muted-foreground/80">
                        {localize(getTaskVerificationHint(item.sourceTask) || "")}
                      </p>
                    )}

                    <TaskStatusControl
                      status={item.status}
                      disabled={updateTaskMutation.isPending && updateTaskMutation.variables?.taskId === item.taskId}
                      compact
                      className="mt-4"
                      allowCompletedSelection={allowsManualCompletion(item.sourceTask)}
                      onChange={(status) => updateTaskMutation.mutate({ taskId: item.taskId, status })}
                    />
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
