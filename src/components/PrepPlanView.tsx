import { motion } from "framer-motion";
import { ArrowUpRight, BookOpen, Brain, CalendarDays, Layers3 } from "lucide-react";

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

      <section className="surface-panel p-6 md:p-7">
        <div className="mb-5 flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-primary" />
          <div>
            <p className="section-label">Roadmap</p>
            <h3 className="mt-1 font-heading text-3xl text-foreground">Week-wise plan</h3>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {roadmap.map((week) => (
            <motion.div
              key={`${plan.id}-${week.week}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24 }}
              className="rounded-2xl border border-border/80 bg-card/70 p-5"
            >
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Week {week.week}</p>
              <h4 className="mt-2 font-heading text-2xl text-foreground">{week.title}</h4>
              <div className="mt-3 flex flex-wrap gap-2">
                {week.focusTopics.map((topic) => (
                  <span key={topic} className="coach-chip border-primary/25">
                    {topic}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-sm uppercase tracking-[0.16em] text-muted-foreground">
                {week.estimatedHours} hours / week
              </p>
              <div className="mt-4 space-y-2">
                {week.goals.map((goal) => (
                  <p key={goal} className="text-sm leading-6 text-foreground/80">
                    {goal}
                  </p>
                ))}
              </div>
            </motion.div>
          ))}
          {!roadmap.length && (
            <div className="rounded-2xl border border-border/80 bg-card/70 p-5 text-sm leading-6 text-muted-foreground xl:col-span-2">
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
                {dayPlan.items.map((item) => (
                  <details
                    key={`${dayPlan.day}-${item.title}`}
                    className="task-row-lift rounded-xl border border-border/70 bg-background/40 px-4 py-3"
                  >
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-medium text-foreground">{item.title}</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {item.type} / {formatHoursFromMinutes(item.estimatedMinutes)} / {item.difficulty}
                        </p>
                      </div>
                      <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Expand</span>
                    </summary>

                    <div className="mt-4 space-y-3 border-t border-border/70 pt-4">
                      <p className="text-sm leading-6 text-foreground/80">
                        {item.summary || "Use this task to build recall, execution, and a clearer interview explanation."}
                      </p>
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
                  </details>
                ))}
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
