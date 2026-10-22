import { motion } from "framer-motion";
import { ArrowUpRight, BookOpen, Brain, CalendarDays, Code2, Layers3 } from "lucide-react";
import { Link } from "react-router-dom";

import type { PrepPlan } from "@/lib/api";
import { formatHoursFromMinutes } from "@/lib/time";

interface PrepPlanViewProps {
  plan: PrepPlan;
}

export default function PrepPlanView({ plan }: PrepPlanViewProps) {
  const roadmap = Array.isArray(plan.roadmap) ? plan.roadmap : [];
  const taskDays = Array.isArray(plan.tasks) ? plan.tasks : [];
  const resources = Array.isArray(plan.resources) ? plan.resources : [];
  const flashcards = Array.isArray(plan.flashcards) ? plan.flashcards : [];

  return (
    <div className="grid gap-6">
      <div className="surface-panel-strong p-6 md:p-7">
        <p className="section-label">Current plan</p>
        <p className="mt-3 font-heading text-3xl text-foreground md:text-4xl">
          {plan.title || `Version ${plan.version}`}
        </p>
        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          v{plan.version} / {plan.durationMonths} month{plan.durationMonths === 1 ? "" : "s"} / {plan.targetRole || "Custom placement track"} / {plan.preferredLanguage || "english"}
        </p>
        <p className="mt-6 section-label">Mentor line</p>
        <p className="mt-3 font-heading text-3xl text-foreground md:text-4xl">
          {plan.coachLine || "Your roadmap is ready."}
        </p>
      </div>

      {(plan.status === "assessment_pending" || plan.metadata?.status === "assessment_pending") && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 md:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-400">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                Baseline Diagnostic Assessment Pending
              </div>
              <h4 className="mt-2.5 font-heading text-2xl text-foreground">
                Calibrate Your Roadmap With A 20-Min Diagnostic
              </h4>
              <p className="mt-1 text-sm text-muted-foreground max-w-2xl leading-relaxed">
                This curriculum was synthesized using verified company guides and role benchmarks. Complete the 20-minute diagnostic assessment to identify your personal weak spots, adjust topic pacing, and lock in high-yield daily tasks.
              </p>
            </div>
            <Link
              to="/assessments"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-black shadow-sm transition hover:bg-amber-400 active:scale-[0.98] shrink-0"
            >
              Take Baseline Diagnostic
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {Boolean(plan.researchReport?.sources?.length) && (
        <section className="surface-panel p-6 md:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-primary" />
              <div>
                <p className="section-label">Evidence-Based Research</p>
                <h3 className="mt-1 font-heading text-2xl text-foreground">
                  {plan.guidanceClassification ||
                    plan.researchReport?.guidanceClassification ||
                    (plan.isGeneralGuidance || plan.researchReport?.isGeneralGuidance
                      ? "General Role Guidance (Unverified Company Specifics)"
                      : "Company-Verified Preparation Framework")}
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(plan.isGeneralGuidance || plan.researchReport?.isGeneralGuidance) ? (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
                  General Guidance
                </span>
              ) : (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                  Verified Company Sources
                </span>
              )}
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {plan.researchReport?.sources?.length || 0} sources
              </span>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {plan.researchReport?.sources?.map((src, i) => (
              <div key={i} className="rounded-xl border border-border/70 bg-card/60 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {src.organization || "Official"}
                    </span>
                    <span className="rounded bg-secondary/30 px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                      {src.confidence}
                    </span>
                  </div>
                  <h5 className="mt-1.5 text-sm font-medium text-foreground">{src.title}</h5>
                  {src.supportedClaims?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {src.supportedClaims.slice(0, 3).map((claim, ci) => (
                        <span key={ci} className="rounded bg-background/80 px-2 py-0.5 text-[11px] text-muted-foreground">
                          {claim}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {src.url && src.url.startsWith("http") && (
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    View official source
                    <ArrowUpRight className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="tactile-card-editorial p-6 md:p-7">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary shadow-[0_0_16px_rgba(201,42,54,0.15)]">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">Curriculum Journey</p>
              <h3 className="font-heading text-3xl text-foreground">Week-by-week placement milestones</h3>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="tactile-badge font-mono text-[11px]">
              {roadmap.length} Milestones
            </span>
            <span className="tactile-badge-crimson font-mono text-[11px]">
              Active: Week 1
            </span>
          </div>
        </div>

        {/* Milestone Timeline Roadmap */}
        <div className="relative space-y-4 before:absolute before:left-5 before:top-4 before:bottom-4 before:w-0.5 before:bg-gradient-to-b before:from-primary before:via-border/60 before:to-border/20 md:before:left-7">
          {roadmap.map((week, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === roadmap.length - 1;
            const goals = (week.goals || ((week as any).goal ? [(week as any).goal, (week as any).milestone].filter(Boolean) : []));
            const topics = (week.focusTopics || (week as any).topics || []);

            return (
              <motion.div
                key={`${plan.id}-${week.week}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.22, delay: idx * 0.03 }}
                className={`relative ml-10 md:ml-14 rounded-2xl border transition-all ${
                  isFirst
                    ? "border-primary/40 bg-gradient-to-r from-primary/[0.08] via-card/80 to-card/60 p-5 md:p-6 shadow-[0_0_24px_rgba(201,42,54,0.08)]"
                    : "border-border/70 bg-card/50 p-5 md:p-6 hover:border-border hover:bg-card/70"
                }`}
              >
                {/* Timeline node marker on the line */}
                <div
                  className={`absolute -left-10 md:-left-14 top-6 flex h-7 w-7 items-center justify-center rounded-full border text-xs font-mono font-bold transition ${
                    isFirst
                      ? "border-primary bg-primary text-primary-foreground shadow-[0_0_12px_rgba(201,42,54,0.4)]"
                      : "border-border/80 bg-background text-muted-foreground"
                  }`}
                >
                  {week.week}
                </div>

                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider ${
                        isFirst
                          ? "bg-primary/20 text-primary border border-primary/30"
                          : isLast
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-400/30"
                            : "bg-muted/40 text-muted-foreground border border-border/60"
                      }`}>
                        {isFirst ? "Current Sprint • Week 1" : isLast ? "Placement Readiness" : `Sprint Milestone ${week.week}`}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground">
                        {week.estimatedHours || 12} hrs scheduled
                      </span>
                    </div>

                    <h4 className="mt-2 font-heading text-2xl text-foreground">
                      {week.title || (week as any).theme || `Week ${week.week} Focus`}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      to="/coding-lab"
                      className="tactile-btn-secondary px-3 py-1.5 text-xs inline-flex items-center gap-1.5 font-medium"
                    >
                      <Code2 className="h-3.5 w-3.5 text-primary" />
                      Practice Lab
                    </Link>
                  </div>
                </div>

                {/* Focus Topics Chips */}
                {topics.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {topics.map((topic: string) => (
                      <span
                        key={topic}
                        className="rounded-lg border border-border/80 bg-background/60 px-2.5 py-1 text-xs font-medium text-foreground/90 transition hover:border-primary/40 hover:bg-primary/5"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                )}

                {/* Goals & Deliverables */}
                {goals.length > 0 && (
                  <div className="mt-4 rounded-xl border border-border/50 bg-background/40 p-3.5 space-y-2">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-mono font-semibold">
                      Weekly Exit Criteria:
                    </p>
                    {goals.map((goal: string, gIdx: number) => (
                      <div key={gIdx} className="flex items-start gap-2 text-sm leading-6 text-foreground/85">
                        <span className="text-primary mt-1">•</span>
                        <span>{goal}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}

          {!roadmap.length && (
            <div className="rounded-2xl border border-border/80 bg-card/70 p-6 text-sm leading-6 text-muted-foreground">
              No roadmap weeks are available yet. Regenerate the plan to rebuild the weekly structure.
            </div>
          )}
        </div>
      </section>

      <section className="surface-panel p-6 md:p-7">
        <div className="mb-5 flex items-center gap-3">
          <Layers3 className="h-5 w-5 text-primary" />
          <div>
            <p className="section-label">Daily tasks</p>
            <h3 className="mt-1 font-heading text-3xl text-foreground">Structured execution</h3>
          </div>
        </div>

        <div className="grid gap-4">
          {taskDays.map((dayPlan) => (
            <div key={`${plan.id}-${dayPlan.day}`} className="rounded-2xl border border-border/80 bg-card/70 p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{dayPlan.day}</p>
                  <h4 className="mt-1 font-heading text-2xl text-foreground">{dayPlan.theme}</h4>
                </div>
                <p className="text-sm uppercase tracking-[0.16em] text-muted-foreground">
                  {formatHoursFromMinutes(dayPlan.totalEstimatedMinutes)}
                </p>
              </div>

              <div className="mt-4 space-y-3">
                {dayPlan.items.map((item) => {
                  const isCoding = item.type === "dsa" || item.type === "coding" || item.type === "sql"
                    || Boolean(item.codingLabUrl)
                    || /leetcode|hackerrank|codeforces|codechef/i.test(item.referenceUrl || "")
                    || /leetcode|fix names|duplicate emails|salary|two sum|reverse/i.test(item.title);
                  const codingUrl = item.codingLabUrl
                    || `/coding-lab?title=${encodeURIComponent(item.title)}${item.referenceUrl ? `&url=${encodeURIComponent(item.referenceUrl)}` : ""}`;

                  return (
                    <details
                      key={`${dayPlan.day}-${item.title}`}
                      className="task-row-lift rounded-xl border border-border/70 bg-background/40 px-4 py-3"
                    >
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-medium text-foreground">{item.title}</p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {item.type} / {formatHoursFromMinutes(item.estimatedMinutes)} / {item.difficulty}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {isCoding && (
                            <Link
                              to={codingUrl}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/25"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Code2 className="h-3.5 w-3.5" />
                              Lab
                            </Link>
                          )}
                          <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Expand</span>
                        </div>
                      </summary>

                      <div className="mt-4 space-y-3 border-t border-border/70 pt-4">
                        <p className="text-sm leading-6 text-foreground/80">
                          {item.summary || "Use this task to build recall, execution, and a clearer interview explanation."}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          {isCoding && (
                            <Link
                              to={codingUrl}
                              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
                            >
                              <Code2 className="h-4 w-4" />
                              Practice in Coding Lab
                            </Link>
                          )}
                          {item.referenceUrl && (
                            <a
                              href={item.referenceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-primary transition hover:text-primary/80"
                            >
                              {item.referenceLabel || item.title}
                              <ArrowUpRight className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>
          ))}
          {!taskDays.length && (
            <div className="rounded-2xl border border-border/80 bg-card/70 p-5 text-sm leading-6 text-muted-foreground">
              No daily task blocks are available yet. Update the plan to regenerate structured execution.
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.04fr_0.96fr]">
        <section className="surface-panel p-6 md:p-7">
          <div className="mb-5 flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-primary" />
            <div>
              <p className="section-label">Resources</p>
              <h3 className="mt-1 font-heading text-3xl text-foreground">Study stack</h3>
            </div>
          </div>

          <div className="space-y-4">
            {resources.map((resource) => (
              <div key={resource.topic} className="rounded-2xl border border-border/80 bg-card/70 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{resource.topic}</p>
                <div className="mt-3 space-y-3">
                  {resource.items.map((item) => (
                    <a
                      key={`${resource.topic}-${item.title}`}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/40 px-4 py-3 text-sm text-foreground transition hover:border-primary/30 hover:bg-primary/10"
                    >
                      <span>{item.title}</span>
                      <ArrowUpRight className="h-4 w-4 text-primary" />
                    </a>
                  ))}
                </div>
              </div>
            ))}
            {!resources.length && (
              <div className="rounded-2xl border border-border/80 bg-card/70 p-4 text-sm leading-6 text-muted-foreground">
                Resource links are missing for this version. Regenerate the plan to rebuild the study stack.
              </div>
            )}
          </div>
        </section>

        <section className="surface-panel p-6 md:p-7">
          <div className="mb-5 flex items-center gap-3">
            <Brain className="h-5 w-5 text-primary" />
            <div>
              <p className="section-label">Flashcards</p>
              <h3 className="mt-1 font-heading text-3xl text-foreground">Recall drills</h3>
            </div>
          </div>

          <div className="grid gap-4">
            {flashcards.map((card) => (
              <details
                key={`${card.topic}-${card.question}`}
                className="group rounded-2xl border border-border/80 bg-card/70 p-4 open:border-primary/30"
              >
                <summary className="cursor-pointer list-none">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{card.topic}</p>
                  <p className="mt-2 text-base font-medium text-foreground">{card.question}</p>
                </summary>
                <p className="mt-4 text-sm leading-6 text-foreground/82">{card.answer}</p>
              </details>
            ))}
            {!flashcards.length && (
              <div className="rounded-2xl border border-border/80 bg-card/70 p-4 text-sm leading-6 text-muted-foreground">
                Flashcards are unavailable for this version. Update the plan to rebuild recall drills.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
