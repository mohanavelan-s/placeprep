import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

interface SoftSyncNoticeProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function SoftSyncNotice({
  title,
  description,
  actionLabel,
  onAction,
}: SoftSyncNoticeProps) {
  return (
    <div className="rounded-[1.2rem] border border-primary/20 bg-primary/5 px-4 py-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full border border-primary/20 bg-primary/10 p-2 text-primary">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm text-foreground">{title}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
        </div>

        {actionLabel && onAction && (
          <Button
            type="button"
            variant="outline"
            className="h-10 shrink-0 border-border/80 bg-background/70"
            onClick={onAction}
          >
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
