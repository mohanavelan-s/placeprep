import { AlertTriangle, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PageStatusPanelProps {
  eyebrow?: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: "default" | "danger";
  loading?: boolean;
}

export default function PageStatusPanel({
  eyebrow = "System",
  title,
  description,
  actionLabel,
  onAction,
  tone = "default",
  loading = false,
}: PageStatusPanelProps) {
  const Icon = loading ? LoaderCircle : AlertTriangle;

  return (
    <section
      className={`surface-panel p-6 md:p-7 ${
        tone === "danger" ? "border-primary/25 bg-[linear-gradient(180deg,hsl(240_11%_9%),hsl(0_22%_8%))]" : ""
      }`}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${
              tone === "danger" ? "border-primary/30 bg-primary/10 text-primary" : "border-border/80 bg-card/70 text-muted-foreground"
            }`}
          >
            <Icon className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </div>
          <div>
            <p className="section-label">{eyebrow}</p>
            <h3 className="mt-2 font-heading text-3xl text-foreground">{title}</h3>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/78">{description}</p>
          </div>
        </div>

        {actionLabel && onAction && (
          <Button type="button" variant={tone === "danger" ? "default" : "outline"} className="shrink-0" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </div>
    </section>
  );
}
