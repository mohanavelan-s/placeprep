import { useQuery } from "@tanstack/react-query";
import { Code2, Github, Globe2, Linkedin } from "lucide-react";

import PageStatusPanel from "@/components/PageStatusPanel";
import PlacePrepLogo from "@/components/PlacePrepLogo";
import ResumeSigilIcon from "@/components/ResumeSigilIcon";
import SoftSyncNotice from "@/components/SoftSyncNotice";
import { useAuth } from "@/context/AuthContext";
import { useQueryErrorLogger } from "@/hooks/use-query-error-logger";
import { fetchLatestPrepPlan, fetchUserProfile } from "@/lib/api";

const iconMap = [
  { key: "linkedinUrl", label: "LinkedIn", Icon: Linkedin },
  { key: "githubUrl", label: "GitHub", Icon: Github },
  { key: "leetcodeUrl", label: "LeetCode", Icon: Code2 },
  { key: "portfolioUrl", label: "Portfolio", Icon: Globe2 },
  { key: "resumeUrl", label: "Resume", Icon: ResumeSigilIcon },
] as const;

export default function ProfilePage() {
  const { user } = useAuth();
  const profileQuery = useQuery({
    queryKey: ["user-profile"],
    queryFn: fetchUserProfile,
  });
  const prepPlanQuery = useQuery({
    queryKey: ["prep-plan", "latest"],
    queryFn: fetchLatestPrepPlan,
  });

  useQueryErrorLogger("ProfilePage:user-profile", profileQuery.error);
  useQueryErrorLogger("ProfilePage:prep-plan", prepPlanQuery.error);

  const profile = profileQuery.data ?? null;
  const latestPlan = prepPlanQuery.data ?? null;

  return (
    <div className="grid gap-6">
      <section className="surface-panel-strong p-6 md:p-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <PlacePrepLogo />
          <div className="rounded-2xl border border-border/80 bg-background/40 px-4 py-3 text-sm text-foreground/80">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Target role</p>
            <p className="mt-2 font-heading text-3xl text-foreground">{user?.targetRole || latestPlan?.targetRole || "Placement prep"}</p>
          </div>
        </div>
      </section>

      <section className="surface-panel p-6 md:p-7">
        <p className="section-label">Profile</p>
        <h2 className="mt-2 font-heading text-4xl text-foreground md:text-5xl">{user?.name}</h2>
        <p className="mt-2 text-sm uppercase tracking-[0.16em] text-muted-foreground">
          @{user?.username || "set-username"} / {user?.email}
        </p>
        <p className="mt-4 max-w-2xl text-base leading-7 text-foreground/80">
          Clean profile view only. Links stay editable in Settings, while this page stays minimal and launch-ready.
        </p>

        <div className="mt-8 flex flex-wrap gap-4">
          {profileQuery.isPending && (
            <PageStatusPanel
              eyebrow="Profile sync"
              title="Loading your personal links."
              description="LinkedIn, GitHub, LeetCode, and portfolio links are being restored."
              loading
            />
          )}

          {profileQuery.isError && (
            <SoftSyncNotice
              title="Profile links are temporarily unavailable."
              description="This page still works. Retry here, or update links later from Settings."
              actionLabel="Retry"
              onAction={() => void profileQuery.refetch()}
            />
          )}

          {iconMap.map(({ key, label, Icon }) => {
            const href = profile?.[key];
            if (!href) {
              return null;
            }

            return (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-border/80 bg-card/70 text-foreground/80 transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground"
                aria-label={label}
                title={label}
              >
                <Icon className="h-6 w-6" />
              </a>
            );
          })}

          {!profileQuery.isPending && !profileQuery.isError && !iconMap.some(({ key }) => Boolean(profile?.[key])) && (
            <div className="rounded-2xl border border-border/80 bg-card/70 px-5 py-4 text-sm leading-6 text-muted-foreground">
              No profile links connected yet. Add them in Settings and this page will switch to icon shortcuts.
            </div>
          )}
        </div>
      </section>

      {latestPlan && (
        <section className="surface-panel p-6 md:p-7">
          <p className="section-label">Current architect plan</p>
          <h3 className="mt-2 font-heading text-3xl text-foreground">
            {latestPlan.title || `Version ${latestPlan.version}`}
          </h3>
          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">v{latestPlan.version}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(latestPlan.targetTopics || []).map((topic) => (
              <span key={topic} className="coach-chip border-primary/25">
                {topic}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
