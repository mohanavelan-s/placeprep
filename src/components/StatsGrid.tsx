import { motion } from "framer-motion";

interface StatsGridProps {
  metrics: Array<{
    label: string;
    value: number | string;
    helper?: string;
  }>;
}

export default function StatsGrid({ metrics }: StatsGridProps) {
  return (
    <div className="section-glow relative">
      <div className="relative z-10 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 + i * 0.12, duration: 0.7 }}
            className="metric-panel group cursor-default p-5 md:p-6"
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{ background: "radial-gradient(ellipse at center, hsl(0 55% 33% / 0.03), transparent 70%)" }}
            />

            <p className="section-label relative z-10 mb-4">
              {stat.label}
            </p>

            <p className="relative z-10 font-heading text-4xl font-medium text-foreground md:text-5xl">
              {stat.value}
            </p>

            <p className="relative z-10 mt-3 text-sm leading-6 body-secondary">
              {stat.helper || "Live metric"}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
