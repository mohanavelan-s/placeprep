import { ArrowRight, Bot, BrainCircuit, LayoutDashboard, ListTodo, LineChart } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const steps = [
  {
    icon: BrainCircuit,
    label: "1. Build the plan",
    copy: "Prep Architect turns strong topics, weak areas, role, and time budget into a named roadmap with a concrete study stack.",
  },
  {
    icon: ListTodo,
    label: "2. Execute the work",
    copy: "Daily tasks pull in specific problems, revision blocks, and creator-led resources so you always know what to do next.",
  },
  {
    icon: LayoutDashboard,
    label: "3. Use the command center",
    copy: "Dashboard keeps countdown pressure, task completion, Power Pocket focus windows, and coach signals in one surface.",
  },
  {
    icon: LineChart,
    label: "4. Track the trend",
    copy: "Progress shows readiness, consistency, and execution so you can correct drift before placement season catches up.",
  },
];

interface HowItWorksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnterDemo?: () => void;
}

export default function HowItWorksDialog({
  open,
  onOpenChange,
  onEnterDemo,
}: HowItWorksDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/80 bg-card text-foreground sm:max-w-4xl">
        <DialogHeader>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-primary/90">
            <Bot className="h-3.5 w-3.5" />
            How It Works
          </div>
          <DialogTitle className="mt-4 font-heading text-4xl font-medium text-foreground">
            PlacePrep runs like a private prep system, not a loose list of links.
          </DialogTitle>
          <DialogDescription className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Start with a plan, convert it into daily execution, then let the workspace keep the pressure visible. Demo mode is safe to explore and fully local.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          {steps.map((step) => {
            const Icon = step.icon;

            return (
              <article
                key={step.label}
                className="rounded-[1.45rem] border border-border/80 bg-background/55 p-5"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">{step.label}</p>
                    <p className="mt-3 text-sm leading-6 text-foreground/82">{step.copy}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="rounded-[1.45rem] border border-border/80 bg-background/55 p-5">
          <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">What changes in this version</p>
          <div className="mt-3 grid gap-2 text-sm leading-6 text-foreground/82 md:grid-cols-2">
            <p>Demo mode lets people explore the app without creating real backend data.</p>
            <p>Prep plans now favor named creators, direct articles, newsletters, and specific problems.</p>
            <p>Loading states use skeletons so the workspace feels alive while data hydrates.</p>
            <p>Plan versions can stay meaningful instead of feeling like blank numbered drafts.</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {onEnterDemo && (
            <Button
              type="button"
              className="gap-2"
              onClick={() => {
                onOpenChange(false);
                onEnterDemo();
              }}
            >
              Explore Demo
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
