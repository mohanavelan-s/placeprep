import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CountdownTimer from "@/components/CountdownTimer";
import XPBar from "@/components/XPBar";
import StatsGrid from "@/components/StatsGrid";
import DailyTasks from "@/components/DailyTasks";
import PowerPocket from "@/components/PowerPocket";
import ProgressCharts from "@/components/ProgressCharts";
import { USER_STATS } from "@/lib/mock-data";

export default function Index() {
  const [focusMode, setFocusMode] = useState(false);

  return (
    <div className="min-h-screen bg-background vignette relative">
      {/* Focus mode darkening overlay */}
      <AnimatePresence>
        {focusMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="focus-mode-overlay"
          />
        )}
      </AnimatePresence>

      {/* Header — barely there */}
      <header className="relative z-10 border-b border-border/40">
        <div className="container max-w-5xl mx-auto px-8 py-5 flex items-end justify-between">
          <div>
            <h1 className="font-heading text-xl font-light tracking-wide text-foreground/70">
              PlacePrep
            </h1>
          </div>
          <p className="font-body text-[9px] tracking-[0.2em] uppercase text-muted-foreground/40">
            {USER_STATS.streak}d streak · {USER_STATS.totalHoursLogged}h logged
          </p>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 container max-w-5xl mx-auto px-8">
        {/* Power Pocket */}
        <div className="pt-6">
          <PowerPocket onFocusMode={setFocusMode} />
        </div>

        {/* Hero Countdown — dominant */}
        <CountdownTimer />

        {/* Thin separator */}
        <div className="h-px mx-16"
          style={{ background: "linear-gradient(90deg, transparent, hsl(0 0% 12%), transparent)" }}
        />

        {/* Metrics */}
        <div className="py-8">
          <StatsGrid />
        </div>

        {/* Streak */}
        <div className="pb-8">
          <XPBar />
        </div>

        {/* Missions */}
        <div className="pb-8">
          <DailyTasks />
        </div>

        {/* Terrain + Charts */}
        <div className="pb-8">
          <ProgressCharts />
        </div>

        {/* Closing */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="text-center py-16 pb-24"
        >
          <div className="h-px w-24 mx-auto mb-8"
            style={{ background: "linear-gradient(90deg, transparent, hsl(0 55% 33% / 0.15), transparent)" }}
          />
          <p className="font-heading text-lg font-light text-muted-foreground/25 italic tracking-wide">
            Stay locked in.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
