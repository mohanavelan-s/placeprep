import { useState } from "react";
import { motion } from "framer-motion";
import { TODAY_MISSIONS } from "@/lib/mock-data";

const categoryAccent: Record<string, string> = {
  DSA: "border-l-primary/50",
  OOPS: "border-l-accent/40",
  DBMS: "border-l-accent/40",
  Project: "border-l-foreground/20",
};

export default function DailyTasks() {
  const [missions, setMissions] = useState(TODAY_MISSIONS);

  const toggleMission = (id: string) => {
    setMissions((prev) =>
      prev.map((m) => (m.id === id ? { ...m, completed: !m.completed } : m))
    );
  };

  const completed = missions.filter((m) => m.completed).length;
  const rate = Math.round((completed / missions.length) * 100);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4, duration: 0.7 }}
      className="bg-gradient-surface rounded-sm border border-border overflow-hidden"
    >
      {/* Header */}
      <div className="p-6 pb-5 flex items-end justify-between">
        <div>
          <p className="font-body text-[8px] tracking-[0.3em] uppercase text-muted-foreground mb-2">
            Today's Missions
          </p>
          <p className="font-heading text-3xl font-light text-foreground">
            {completed}<span className="text-muted-foreground/40 text-xl ml-1">/ {missions.length}</span>
          </p>
        </div>
        <div className="text-right">
          <p className={`font-heading text-3xl font-light ${rate >= 50 ? "text-foreground" : "text-gradient-blood"}`}>
            {rate}%
          </p>
          <p className="text-[8px] text-muted-foreground/40 tracking-[0.2em] uppercase mt-1">execution</p>
        </div>
      </div>

      {/* Thin progress line */}
      <div className="h-[1px] bg-border relative">
        <motion.div
          animate={{ width: `${rate}%` }}
          transition={{ duration: 0.6 }}
          className="h-full bg-primary/40 absolute left-0 top-0"
        />
      </div>

      {/* Missions list */}
      <div>
        {missions.map((mission, i) => (
          <motion.div
            key={mission.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 + i * 0.06, duration: 0.5 }}
            onClick={() => toggleMission(mission.id)}
            className={`mission-row flex items-center gap-4 px-6 py-4 cursor-pointer border-l-2 border-b border-b-border/50 ${
              categoryAccent[mission.category] || "border-l-transparent"
            } ${mission.completed ? "opacity-30" : ""}`}
          >
            {/* Status dot */}
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-500 ${
              mission.completed
                ? "bg-foreground/20"
                : "bg-primary/60 animate-glow-breathe"
            }`} />

            <div className="flex-1 min-w-0">
              <p className={`font-body text-[13px] tracking-wide transition-all duration-300 ${
                mission.completed ? "line-through text-muted-foreground/50" : "text-foreground/80"
              }`}>
                {mission.title}
              </p>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-[8px] tracking-[0.25em] uppercase text-muted-foreground/60">
                  {mission.category}
                </span>
                <span className="text-[8px] text-muted-foreground/25">·</span>
                <span className="text-[8px] text-muted-foreground/40">{mission.ref}</span>
                <span className="text-[8px] text-muted-foreground/25">·</span>
                <span className="text-[8px] text-muted-foreground/40">{mission.timeEstimate}m</span>
              </div>
            </div>

            <span className={`text-[8px] tracking-[0.25em] uppercase transition-colors duration-300 ${
              mission.intensity === "Low" ? "text-muted-foreground/30" :
              mission.intensity === "Mid" ? "text-accent/40" :
              mission.intensity === "Execution" ? "text-primary/40" :
              "text-muted-foreground/30"
            }`}>
              {mission.intensity}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
