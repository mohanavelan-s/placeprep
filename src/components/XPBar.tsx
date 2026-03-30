import { motion } from "framer-motion";

interface XPBarProps {
  streak: number;
  missionsCompleted: number;
}

export default function XPBar({ streak, missionsCompleted }: XPBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2, duration: 0.7 }}
      className="surface-panel card-hover p-6"
    >
      <div className="flex items-center justify-between mb-5">
        <p className="section-label">
          Discipline Streak
        </p>
        <p className="text-sm text-muted-foreground">
          {streak} consecutive days
        </p>
      </div>

      <div className="flex gap-[3px]">
        {Array.from({ length: 30 }, (_, i) => {
          const isActive = i < streak;
          const isCurrent = i === streak;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, scaleY: 0.3 }}
              animate={{ opacity: 1, scaleY: 1 }}
              transition={{ delay: 0.3 + i * 0.02, duration: 0.4 }}
              className={`h-8 flex-1 rounded-[1px] transition-all duration-500 ${
                isActive
                  ? "bg-primary/50"
                  : isCurrent
                  ? "bg-primary/15 ember-breathe"
                  : "bg-muted/60"
              }`}
              style={isActive ? {
                background: `linear-gradient(180deg, hsl(0 55% 33% / ${0.3 + (i / 30) * 0.4}), hsl(0 55% 33% / ${0.15 + (i / 30) * 0.2}))`,
              } : undefined}
            />
          );
        })}
      </div>

      <div className="flex justify-between mt-4">
        <p className="text-sm text-muted-foreground">Day 1</p>
        <p className="text-sm text-muted-foreground">
          {missionsCompleted} missions executed
        </p>
        <p className="text-sm text-muted-foreground">Day 30</p>
      </div>
    </motion.div>
  );
}
