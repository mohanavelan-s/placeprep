import { motion } from "framer-motion";
import { BarChart, Bar, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";

import type { TopicStrengthPoint, WeeklyProgressPoint } from "@/lib/api";

interface DashboardProgressChartsProps {
  weeklyProgress: WeeklyProgressPoint[];
  topicStrength: TopicStrengthPoint[];
}

export default function DashboardProgressCharts({
  weeklyProgress,
  topicStrength,
}: DashboardProgressChartsProps) {
  const chartProgress = weeklyProgress.length
    ? weeklyProgress
    : Array.from({ length: 7 }, (_, index) => ({
        day: ["M", "T", "W", "T", "F", "S", "S"][index],
        date: "",
        missions: 0,
        hours: 0,
      }));
  const terrain = topicStrength.length
    ? topicStrength
    : [
        { topic: "DSA", strength: 0 },
        { topic: "Core", strength: 0 },
        { topic: "Project", strength: 0 },
      ];
  const maxMissions = Math.max(1, ...chartProgress.map((entry) => entry.missions));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55, duration: 0.7 }}
        className="surface-panel card-hover p-6"
      >
        <p className="section-label mb-3">
          Weekly Execution
        </p>
        <p className="mb-8 text-sm leading-6 body-secondary">
          Completed tasks across the last seven days.
        </p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={chartProgress} barCategoryGap="30%">
            <XAxis
              dataKey="day"
              stroke="hsl(0 0% 60%)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              dy={10}
              style={{ letterSpacing: "0.15em" }}
            />
            <YAxis hide />
            <Bar dataKey="missions" radius={[1, 1, 0, 0]}>
              {chartProgress.map((entry, index) => (
                <Cell
                  key={index}
                  fill={
                    entry.missions === maxMissions
                      ? "hsl(0 55% 33%)"
                      : `hsl(0 0% ${12 + (entry.missions / maxMissions) * 10}%)`
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.7 }}
        className="surface-panel card-hover p-6"
      >
        <p className="section-label mb-3">
          Topic Readiness
        </p>
        <p className="mb-8 text-sm leading-6 body-secondary">
          Strength shifts based on completion quality and consistency.
        </p>
        <div className="space-y-3">
          {terrain.map((topic, index) => (
            <div key={topic.topic} className="group flex items-center gap-3">
              <span className="w-24 shrink-0 text-right text-sm tracking-wide text-muted-foreground transition-colors duration-300 group-hover:text-foreground/80">
                {topic.topic}
              </span>
              <div className="h-[2px] flex-1 overflow-hidden rounded-full bg-muted/40">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${topic.strength}%` }}
                  transition={{ duration: 0.8, delay: 0.7 + index * 0.04 }}
                  className="h-full rounded-full"
                  style={{
                    background:
                      topic.strength >= 70
                        ? "hsl(30 8% 40%)"
                        : topic.strength >= 40
                          ? "hsl(38 40% 38% / 0.6)"
                          : "hsl(0 55% 33% / 0.5)",
                  }}
                />
              </div>
              <span className="w-10 text-sm text-muted-foreground transition-colors duration-300 group-hover:text-foreground/60">
                {topic.strength}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
