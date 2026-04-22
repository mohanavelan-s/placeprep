import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, FolderUp, ImageIcon, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import ClearHistoryButton from "@/components/ClearHistoryButton";
import PageStatusPanel from "@/components/PageStatusPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/context/LanguageContext";
import { useQueryErrorLogger } from "@/hooks/use-query-error-logger";
import { clearUploadedProofHistory, fetchUploadedImages, type Task, uploadImage } from "@/lib/api";
import { getTaskVerificationMode } from "@/lib/task-verification";
import type { UiLanguage } from "@/lib/ui-language";

function formatProofDate(value?: string | null) {
  if (!value) {
    return "Just now";
  }

  try {
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

interface WorkProofPanelProps {
  tasks?: Task[];
}

const WORK_PROOF_TRANSLATIONS: Record<string, Record<Exclude<UiLanguage, "english">, string>> = {
  "Proof of work": {
    tamil: "வேலை ஆதாரம்",
    hindi: "कार्य प्रमाण",
  },
  "Drop a visual record after you finish.": {
    tamil: "முடித்த பிறகு ஒரு காட்சி ஆதாரத்தை பதிவு செய்யுங்கள்.",
    hindi: "काम पूरा होने के बाद एक दृश्य प्रमाण छोड़ें।",
  },
  "Upload screenshots or photographs of completed work. When the upload is linked to a task, PlacePrep can verify it and mark the task complete automatically.": {
    tamil: "முடிக்கப்பட்ட வேலைக்கான ஸ்கிரீன்ஷாட் அல்லது புகைப்படத்தை பதிவேற்றுங்கள். அது ஒரு பணியுடன் இணைக்கப்பட்டால், PlacePrep அதை சரிபார்த்து தானாகவே பூர்த்தியாக குறிக்கும்.",
    hindi: "पूरा किए गए काम के स्क्रीनशॉट या फ़ोटो अपलोड करें। जब अपलोड किसी टास्क से जुड़ा हो, PlacePrep उसे सत्यापित करके टास्क को अपने आप पूरा चिह्नित कर सकता है।",
  },
  "Upload proof": {
    tamil: "ஆதாரம் பதிவேற்று",
    hindi: "प्रमाण अपलोड करें",
  },
  "No proof image chosen": {
    tamil: "ஆதாரப் படம் தேர்ந்தெடுக்கப்படவில்லை",
    hindi: "कोई प्रमाण चित्र नहीं चुना गया",
  },
  "Screenshot or photo": {
    tamil: "ஸ்கிரீன்ஷாட் அல்லது புகைப்படம்",
    hindi: "स्क्रीनशॉट या फ़ोटो",
  },
  "Replace image": {
    tamil: "படத்தை மாற்று",
    hindi: "चित्र बदलें",
  },
  "Choose image": {
    tamil: "படத்தை தேர்வு செய்",
    hindi: "चित्र चुनें",
  },
  "Link this proof to a task": {
    tamil: "இந்த ஆதாரத்தை ஒரு பணியுடன் இணை",
    hindi: "इस प्रमाण को किसी टास्क से जोड़ें",
  },
  "General proof upload": {
    tamil: "பொது ஆதார பதிவேற்றம்",
    hindi: "सामान्य प्रमाण अपलोड",
  },
  "This task can auto-check against the saved LeetCode profile or this uploaded proof.": {
    tamil: "இந்த பணி சேமிக்கப்பட்ட LeetCode சுயவிவரம் அல்லது இங்கு பதிவேற்றிய ஆதாரத்தின் மூலம் தானாகச் சரிபார்க்கப்படும்.",
    hindi: "यह टास्क सेव किए गए LeetCode प्रोफ़ाइल या इस अपलोड किए गए प्रमाण से अपने आप जाँच सकता है।",
  },
  "This linked task will be auto-verified from the uploaded proof.": {
    tamil: "இந்த இணைக்கப்பட்ட பணி பதிவேற்றிய ஆதாரத்தின் மூலம் தானாகச் சரிபார்க்கப்படும்.",
    hindi: "यह जुड़ा हुआ टास्क अपलोड किए गए प्रमाण से अपने आप सत्यापित होगा।",
  },
  "This linked task still supports manual completion.": {
    tamil: "இந்த இணைக்கப்பட்ட பணி இன்னும் கைமுறை பூர்த்தியையும் அனுமதிக்கிறது.",
    hindi: "यह जुड़ा हुआ टास्क अभी भी मैनुअल पूर्णता को अनुमति देता है।",
  },
  "Choose a task if you want PlacePrep to auto-verify and complete it from the uploaded proof.": {
    tamil: "பதிவேற்றிய ஆதாரத்தின் மூலம் PlacePrep தானாகச் சரிபார்த்து பூர்த்தி செய்ய வேண்டுமெனில், ஒரு பணியைத் தேர்வு செய்யுங்கள்.",
    hindi: "यदि आप चाहते हैं कि PlacePrep अपलोड किए गए प्रमाण से अपने आप सत्यापित करके पूरा करे, तो एक टास्क चुनें।",
  },
  "What did you finish? Example: Solved Two Sum on LeetCode and uploaded the accepted submission screen.": {
    tamil: "நீங்கள் என்ன முடித்தீர்கள்? உதாரணம்: LeetCode இல் Two Sum தீர்த்து, accepted submission திரையை பதிவேற்றினேன்.",
    hindi: "आपने क्या पूरा किया? उदाहरण: LeetCode पर Two Sum हल किया और accepted submission स्क्रीन अपलोड की।",
  },
  "Upload proof shot": {
    tamil: "ஆதாரப் படத்தை பதிவேற்று",
    hindi: "प्रमाण चित्र अपलोड करें",
  },
  "Recent uploads": {
    tamil: "சமீபத்திய பதிவேற்றங்கள்",
    hindi: "हाल की अपलोड",
  },
  "Your latest screenshots and photographs stay visible here.": {
    tamil: "உங்கள் சமீபத்திய ஸ்கிரீன்ஷாட்கள் மற்றும் புகைப்படங்கள் இங்கே தெரியும்.",
    hindi: "आपके नवीनतम स्क्रीनशॉट और फ़ोटो यहाँ दिखाई देंगे।",
  },
  "Proof sync": {
    tamil: "ஆதார ஒத்திசைவு",
    hindi: "प्रमाण सिंक",
  },
  "Loading your recent proof uploads.": {
    tamil: "உங்கள் சமீபத்திய ஆதார பதிவேற்றங்கள் ஏற்றப்படுகின்றன.",
    hindi: "आपकी हाल की प्रमाण अपलोड लोड हो रही हैं।",
  },
  "PlacePrep is restoring screenshots and work photographs.": {
    tamil: "PlacePrep ஸ்கிரீன்ஷாட்களையும் வேலைப் புகைப்படங்களையும் மீட்டெடுக்கிறது.",
    hindi: "PlacePrep स्क्रीनशॉट और कार्य फ़ोटो बहाल कर रहा है।",
  },
  "Proof fallback": {
    tamil: "ஆதார மாற்று நிலை",
    hindi: "प्रमाण फॉलबैक",
  },
  "Proof history could not be loaded.": {
    tamil: "ஆதார வரலாற்றை ஏற்ற முடியவில்லை.",
    hindi: "प्रमाण इतिहास लोड नहीं हो सका।",
  },
  "You can still upload a new proof shot. Retry when you want the gallery back.": {
    tamil: "புதிய ஆதாரப் படத்தை இன்னும் பதிவேற்றலாம். கேலரி திரும்ப வேண்டுமெனில் மீண்டும் முயலுங்கள்.",
    hindi: "आप अभी भी नया प्रमाण अपलोड कर सकते हैं। जब गैलरी फिर चाहिए हो तब पुनः प्रयास करें।",
  },
  "Proof upload": {
    tamil: "ஆதார பதிவேற்றம்",
    hindi: "प्रमाण अपलोड",
  },
  "No proof uploads yet. Your first completed-work screenshot will appear here.": {
    tamil: "இன்னும் ஆதார பதிவேற்றங்கள் இல்லை. உங்கள் முதல் நிறைவு செய்யப்பட்ட வேலை ஸ்கிரீன்ஷாட் இங்கே தோன்றும்.",
    hindi: "अभी तक कोई प्रमाण अपलोड नहीं है। आपका पहला completed-work स्क्रीनशॉट यहाँ दिखाई देगा।",
  },
  "Proof verified and the linked task was marked complete.": {
    tamil: "ஆதாரம் சரிபார்க்கப்பட்டது; இணைக்கப்பட்ட பணி முடிந்ததாக குறிக்கப்பட்டது.",
    hindi: "प्रमाण सत्यापित हुआ और जुड़ा हुआ टास्क पूर्ण चिह्नित कर दिया गया।",
  },
  "Proof uploaded. Verification needs a clearer task match before completion.": {
    tamil: "ஆதாரம் பதிவேற்றப்பட்டது. பூர்த்தியாக குறிக்க முன் இன்னும் தெளிவான பொருத்தம் தேவை.",
    hindi: "प्रमाण अपलोड हो गया। पूर्ण चिह्नित करने से पहले और स्पष्ट मिलान चाहिए।",
  },
  "Proof uploaded.": {
    tamil: "ஆதாரம் பதிவேற்றப்பட்டது.",
    hindi: "प्रमाण अपलोड हो गया।",
  },
  Clear: {
    tamil: "அழி",
    hindi: "साफ़ करें",
  },
  Refresh: {
    tamil: "புதுப்பிக்க",
    hindi: "रीफ़्रेश",
  },
  "Clear proof history?": {
    tamil: "ஆதார வரலாற்றை அழிக்கவா?",
    hindi: "क्या प्रमाण इतिहास साफ़ करें?",
  },
  "This removes saved proof uploads for this account. Profile avatars will be kept.": {
    tamil: "இந்த கணக்கில் சேமித்துள்ள ஆதாரப் பதிவேற்றங்களை இது அகற்றும். சுயவிவரப் படங்கள் நீங்காது.",
    hindi: "यह इस खाते के सहेजे गए प्रमाण अपलोड हटाएगा। प्रोफ़ाइल चित्र सुरक्षित रहेंगे।",
  },
  "Clear history": {
    tamil: "வரலாற்றை அழி",
    hindi: "इतिहास साफ़ करें",
  },
  Cancel: {
    tamil: "ரத்து செய்",
    hindi: "रद्द करें",
  },
  "Clearing...": {
    tamil: "அழிக்கப்படுகிறது...",
    hindi: "साफ़ किया जा रहा है...",
  },
  Uploading: {
    tamil: "பதிவேற்றப்படுகிறது...",
    hindi: "अपलोड हो रहा है...",
  },
  "Unable to upload proof.": {
    tamil: "ஆதாரத்தை பதிவேற்ற முடியவில்லை.",
    hindi: "प्रमाण अपलोड नहीं हो सका।",
  },
  "Proof history was already empty.": {
    tamil: "ஆதார வரலாறு ஏற்கனவே காலியாக இருந்தது.",
    hindi: "प्रमाण इतिहास पहले से खाली था।",
  },
  "Unable to clear proof history.": {
    tamil: "ஆதார வரலாற்றை அழிக்க முடியவில்லை.",
    hindi: "प्रमाण इतिहास साफ़ नहीं हो सका।",
  },
};

export default function WorkProofPanel({ tasks = [] }: WorkProofPanelProps) {
  const queryClient = useQueryClient();
  const { language, t } = useLanguage();
  const localize = (text: string) => WORK_PROOF_TRANSLATIONS[text]?.[language] || t(text);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [proofDate, setProofDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedTaskId, setSelectedTaskId] = useState("none");
  const openTasks = tasks.filter((task) => task.status !== "completed" && task.status !== "skipped");

  const proofsQuery = useQuery({
    queryKey: ["uploads", "proofs"],
    queryFn: () => fetchUploadedImages({ limit: 12 }),
  });

  useQueryErrorLogger("WorkProofPanel:proofs", proofsQuery.error);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) {
        throw new Error("Choose a proof image before uploading.");
      }

      return uploadImage(file, {
        taskId: selectedTaskId !== "none" ? selectedTaskId : undefined,
        caption: caption.trim() || undefined,
        proofDate: proofDate || undefined,
      });
    },
    onSuccess: async (result) => {
      setFile(null);
      setCaption("");
      setSelectedTaskId("none");
      await queryClient.invalidateQueries({ queryKey: ["uploads", "proofs"] });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks", "today"] }),
        queryClient.invalidateQueries({ queryKey: ["progress-summary"] }),
      ]);

      if (result.verification?.verified) {
        toast.success(localize("Proof verified and the linked task was marked complete."));
        return;
      }

      if (result.verification?.attempted) {
        toast.message(result.verification.reason || localize("Proof uploaded. Verification needs a clearer task match before completion."));
        return;
      }

      toast.success(localize("Proof uploaded."));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : localize("Unable to upload proof."));
    },
  });

  const clearHistoryMutation = useMutation({
    mutationFn: clearUploadedProofHistory,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["uploads", "proofs"] });
      toast.success(
        result.deleted
          ? `Proof history cleared from ${result.deleted} uploaded item${result.deleted === 1 ? "" : "s"}.`
          : localize("Proof history was already empty."),
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : localize("Unable to clear proof history."));
    },
  });

  return (
    <section className="surface-panel p-6 md:p-7">
      <div className="mb-6">
        <p className="section-label">{localize("Proof of work")}</p>
        <h3 className="mt-2 font-heading text-3xl text-foreground">
          {localize("Drop a visual record after you finish.")}
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          {localize("Upload screenshots or photographs of completed work. When the upload is linked to a task, PlacePrep can verify it and mark the task complete automatically.")}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[1.35rem] border border-border/80 bg-card/65 p-5">
          <div className="flex items-center gap-2 text-foreground">
            <Camera className="h-4 w-4 text-primary" />
            <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">{localize("Upload proof")}</p>
          </div>

          <div className="mt-4 grid gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />

            <div className="flex min-h-14 items-center justify-between gap-3 rounded-[1.2rem] border border-border/80 bg-background/70 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">
                  {file?.name || localize("No proof image chosen")}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {localize("Screenshot or photo")}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {file && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 px-3"
                    onClick={() => {
                      setFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                  >
                    {localize("Clear")}
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  className="h-10 gap-2 border-border/80 bg-card/60"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FolderUp className="h-4 w-4" />
                  {file ? localize("Replace image") : localize("Choose image")}
                </Button>
              </div>
            </div>

            <Input
              type="date"
              value={proofDate}
              onChange={(event) => setProofDate(event.target.value)}
              className="h-11 border-border/80 bg-background/70"
            />

            <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
              <SelectTrigger className="h-11 border-border/80 bg-background/70">
                <SelectValue placeholder={localize("Link this proof to a task")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{localize("General proof upload")}</SelectItem>
                {openTasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground/80">
              {selectedTaskId !== "none"
                ? (() => {
                    const selectedTask = openTasks.find((task) => task.id === selectedTaskId);
                    const mode = selectedTask ? getTaskVerificationMode(selectedTask) : "manual";

                    if (mode === "leetcode_profile_or_proof") {
                      return localize("This task can auto-check against the saved LeetCode profile or this uploaded proof.");
                    }

                    if (mode === "proof_upload") {
                      return localize("This linked task will be auto-verified from the uploaded proof.");
                    }

                    return localize("This linked task still supports manual completion.");
                  })()
                : localize("Choose a task if you want PlacePrep to auto-verify and complete it from the uploaded proof.")}
            </p>

            <Textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder={localize("What did you finish? Example: Solved Two Sum on LeetCode and uploaded the accepted submission screen.")}
              className="min-h-[130px] border-border/80 bg-background/70"
            />

            <Button
              type="button"
              className="h-11 gap-2"
              onClick={() => uploadMutation.mutate()}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImageIcon className="h-4 w-4" />
              )}
              {uploadMutation.isPending ? localize("Uploading") : localize("Upload proof shot")}
            </Button>
          </div>
        </div>

        <div className="rounded-[1.35rem] border border-border/80 bg-card/65 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">{localize("Recent uploads")}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {localize("Your latest screenshots and photographs stay visible here.")}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-10 gap-2 border-border/80 bg-background/70"
                onClick={() => void proofsQuery.refetch()}
              >
                <RefreshCw className="h-4 w-4" />
                {localize("Refresh")}
              </Button>

              <ClearHistoryButton
                title={localize("Clear proof history?")}
                description={localize("This removes saved proof uploads for this account. Profile avatars will be kept.")}
                onConfirm={() => clearHistoryMutation.mutate()}
                pending={clearHistoryMutation.isPending}
                disabled={!(proofsQuery.data || []).length}
                buttonLabel={localize("Clear history")}
                pendingLabel={localize("Clearing...")}
                confirmLabel={localize("Clear history")}
                cancelLabel={localize("Cancel")}
                className="h-10 gap-2 border-border/80 bg-background/70"
              />
            </div>
          </div>

          {proofsQuery.isPending && !proofsQuery.data && (
            <div className="mt-4">
              <PageStatusPanel
                eyebrow={localize("Proof sync")}
                title={localize("Loading your recent proof uploads.")}
                description={localize("PlacePrep is restoring screenshots and work photographs.")}
                loading
              />
            </div>
          )}

          {proofsQuery.isError && (
            <div className="mt-4">
              <PageStatusPanel
                eyebrow={localize("Proof fallback")}
                title={localize("Proof history could not be loaded.")}
                description={localize("You can still upload a new proof shot. Retry when you want the gallery back.")}
                actionLabel={localize("Retry")}
                onAction={() => void proofsQuery.refetch()}
                tone="danger"
              />
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(proofsQuery.data || []).map((proof) => (
              <a
                key={proof.id}
                href={proof.secureUrl}
                target="_blank"
                rel="noreferrer"
                className="group overflow-hidden rounded-[1.05rem] border border-border/80 bg-background/45 transition hover:border-primary/30"
              >
                <div className="aspect-[5/4] overflow-hidden bg-black/20">
                  <img
                    src={proof.secureUrl}
                    alt={proof.caption || "Proof upload"}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="space-y-2 px-3 py-3">
                  <p className="line-clamp-2 text-sm text-foreground">
                    {proof.caption || localize("Proof upload")}
                  </p>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    {formatProofDate(proof.proofDate || proof.createdAt)}
                  </p>
                </div>
              </a>
            ))}
          </div>

          {!proofsQuery.isPending && !proofsQuery.isError && !(proofsQuery.data || []).length && (
            <div className="mt-4 rounded-[1.1rem] border border-border/80 bg-background/45 px-4 py-4 text-sm text-muted-foreground">
              {localize("No proof uploads yet. Your first completed-work screenshot will appear here.")}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
