import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";
import { type TaskStatus } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { UiLanguage } from "@/lib/ui-language";

const baseStatusOptions: Array<{ value: TaskStatus; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];

const activeStatusClasses: Record<TaskStatus, string> = {
  pending: "border-border/80 bg-background/70 text-foreground/85",
  in_progress: "border-amber-400/30 bg-amber-500/10 text-amber-100",
  completed: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
  skipped: "border-border/80 bg-background/70 text-muted-foreground",
};

const STATUS_TRANSLATIONS: Record<string, Record<Exclude<UiLanguage, "english">, string>> = {
  Pending: {
    tamil: "நிலுவை",
    hindi: "लंबित",
  },
  "In progress": {
    tamil: "நடைமுறையில்",
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
};

interface TaskStatusControlProps {
  status: TaskStatus;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
  stopPropagation?: boolean;
  allowCompletedSelection?: boolean;
  onChange: (status: TaskStatus) => void;
}

export default function TaskStatusControl({
  status,
  disabled = false,
  compact = false,
  className,
  stopPropagation = false,
  allowCompletedSelection = true,
  onChange,
}: TaskStatusControlProps) {
  const { language, t } = useLanguage();
  const localize = (text: string) => STATUS_TRANSLATIONS[text]?.[language] || t(text);
  const coreStatusOptions = allowCompletedSelection || status === "completed"
    ? baseStatusOptions
    : baseStatusOptions.filter((option) => option.value !== "completed");
  const statusOptions = status === "skipped"
    ? [...coreStatusOptions, { value: "skipped" as const, label: "Skipped" }]
    : coreStatusOptions;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {statusOptions.map((option) => {
        const isActive = option.value === status;

        return (
          <Button
            key={option.value}
            type="button"
            variant={isActive ? "outline" : "ghost"}
            size={compact ? "sm" : "default"}
            className={cn(
              "rounded-full border px-3 text-[11px] uppercase tracking-[0.16em]",
              compact ? "h-8" : "h-9",
              isActive
                ? activeStatusClasses[option.value]
                : "border-border/60 bg-background/30 text-muted-foreground hover:border-border hover:bg-background/55 hover:text-foreground",
            )}
            disabled={disabled}
            onClick={(event) => {
              if (stopPropagation) {
                event.stopPropagation();
              }

              if (!isActive) {
                onChange(option.value);
              }
            }}
          >
            {disabled && isActive ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {localize(option.label)}
          </Button>
        );
      })}
    </div>
  );
}
