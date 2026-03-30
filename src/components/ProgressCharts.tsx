import { motion } from "framer-motion";
import { WEEKLY_PROGRESS, TOPIC_STRENGTH } from "@/lib/mock-data";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell,
} from "recharts";

export default function ProgressCharts() {
  const maxMissions = Math.max(...WEEKLY_PROGRESS.map(d => d.missions));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Weekly Execution */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55, duration: 0.7 }}
        className="bg-gradient-surface rounded-sm border border-border p-6 card-hover"
      >
        <p className="font-body text-[8px] tracking-[0.3em] uppercase text-muted-foreground mb-8">
          Weekly Execution
        </p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={WEEKLY_PROGRESS} barCategoryGap="30%">
            <XAxis
              dataKey="day"
              stroke="hsl(30 4% 22%)"
              fontSize={8}
              tickLine={false}
              axisLine={false}
              dy={10}
              style={{ letterSpacing: "0.15em" }}
            />
            <YAxis hide />
            <Bar dataKey="missions" radius={[1, 1, 0, 0]}>
              {WEEKLY_PROGRESS.map((entry, index) => (
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

      {/* Terrain Map */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.7 }}
        className="bg-gradient-surface rounded-sm border border-border p-6 card-hover"
      >
        <p className="font-body text-[8px] tracking-[0.3em] uppercase text-muted-foreground mb-8">
          Terrain
        </p>
        <div className="space-y-3">
          {TOPIC_STRENGTH.map((topic, i) => (
            <div key={topic.topic} className="flex items-center gap-3 group">
              <span className="text-[9px] text-muted-foreground/50 w-16 text-right shrink-0 tracking-wide group-hover:text-muted-foreground/80 transition-colors duration-300">
                {topic.topic}
              </span>
              <div className="flex-1 h-[2px] bg-muted/40 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${topic.strength}%` }}
                  transition={{ duration: 0.8, delay: 0.7 + i * 0.04 }}
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
              <span className="text-[9px] text-muted-foreground/30 w-6 font-body group-hover:text-muted-foreground/60 transition-colors duration-300">
                {topic.strength}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
