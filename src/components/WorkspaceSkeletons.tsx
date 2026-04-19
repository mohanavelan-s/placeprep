import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";

function PanelShell({ children }: { children: ReactNode }) {
  return <section className="surface-panel p-6 md:p-7">{children}</section>;
}

export function DashboardSkeleton() {
  return (
    <div className="grid gap-6">
      <PanelShell>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-4 h-8 w-80 max-w-full" />
        <div className="mt-5 flex gap-3">
          <Skeleton className="h-11 w-28 rounded-full" />
          <Skeleton className="h-11 w-40 rounded-full" />
        </div>
      </PanelShell>
      <PanelShell>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-4 h-10 w-96 max-w-full" />
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="rounded-2xl border border-border/70 bg-card/60 p-5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-4 h-10 w-16" />
              <Skeleton className="mt-4 h-3 w-full" />
            </div>
          ))}
        </div>
      </PanelShell>
      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <PanelShell>
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-4 h-10 w-24" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="rounded-xl border border-border/70 bg-card/60 p-4">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="mt-3 h-3 w-56" />
              </div>
            ))}
          </div>
        </PanelShell>
        <PanelShell>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-4 h-8 w-56" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        </PanelShell>
      </div>
    </div>
  );
}

export function PrepArchitectSkeleton() {
  return (
    <div className="grid gap-6">
      <PanelShell>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-4 h-12 w-[42rem] max-w-full" />
        <Skeleton className="mt-4 h-4 w-[34rem] max-w-full" />
      </PanelShell>
      <PanelShell>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-4 h-10 w-80 max-w-full" />
          </div>
          <Skeleton className="h-11 w-36 rounded-full" />
        </div>
        <div className="mt-8 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-6">
            <Skeleton className="h-36 w-full rounded-2xl" />
            <Skeleton className="h-36 w-full rounded-2xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-44 w-full rounded-2xl" />
          </div>
        </div>
      </PanelShell>
    </div>
  );
}

export function ProgressSkeleton() {
  return (
    <div className="grid gap-6">
      <PanelShell>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-4 h-12 w-[32rem] max-w-full" />
      </PanelShell>
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <PanelShell key={index}>
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-4 h-10 w-16" />
            <Skeleton className="mt-4 h-3 w-full" />
          </PanelShell>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[0.84fr_1.16fr]">
        <Skeleton className="h-56 w-full rounded-[1.5rem]" />
        <Skeleton className="h-56 w-full rounded-[1.5rem]" />
      </div>
      <PanelShell>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-4 h-9 w-48" />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      </PanelShell>
    </div>
  );
}

export function AssessmentsSkeleton() {
  return (
    <div className="grid gap-6">
      <PanelShell>
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-4 h-12 w-[34rem] max-w-full" />
        <Skeleton className="mt-4 h-4 w-[28rem] max-w-full" />
      </PanelShell>
      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <PanelShell>
          <Skeleton className="h-4 w-24" />
          <div className="mt-6 grid gap-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        </PanelShell>
        <PanelShell>
          <Skeleton className="h-4 w-28" />
          <div className="mt-6 space-y-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-36 w-full rounded-2xl" />
            ))}
          </div>
        </PanelShell>
      </div>
    </div>
  );
}

export function TasksSkeleton() {
  return (
    <div className="grid gap-6">
      <PanelShell>
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-4 h-12 w-[28rem] max-w-full" />
        <div className="mt-8 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
      </PanelShell>
      <section className="surface-panel overflow-hidden">
        <div className="border-b border-border/70 px-6 py-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-4 h-9 w-56" />
        </div>
        <div className="space-y-3 px-6 py-6">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      </section>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="grid gap-6">
      <PanelShell>
        <Skeleton className="h-12 w-40" />
        <Skeleton className="mt-4 h-10 w-44" />
      </PanelShell>
      <PanelShell>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-4 h-10 w-48" />
        <Skeleton className="mt-4 h-4 w-72" />
        <div className="mt-8 flex gap-4">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-14 w-14 rounded-2xl" />
          ))}
        </div>
      </PanelShell>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="grid gap-6">
      <PanelShell>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-4 h-12 w-[32rem] max-w-full" />
      </PanelShell>
      <PanelShell>
        <Skeleton className="h-4 w-20" />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-11 w-full rounded-xl" />
          ))}
        </div>
      </PanelShell>
      <PanelShell>
        <Skeleton className="h-4 w-28" />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      </PanelShell>
    </div>
  );
}

export function MentorSkeleton() {
  return (
    <div className="grid gap-6">
      <PanelShell>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-4 h-12 w-[30rem] max-w-full" />
      </PanelShell>
      <section className="surface-panel overflow-hidden">
        <div className="border-b border-border/70 px-6 py-5">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="mt-4 h-9 w-40" />
        </div>
        <div className="space-y-4 px-6 py-5">
          <Skeleton className="h-20 w-[80%] rounded-2xl" />
          <Skeleton className="ml-auto h-20 w-[72%] rounded-2xl" />
          <Skeleton className="h-20 w-[78%] rounded-2xl" />
        </div>
      </section>
    </div>
  );
}
