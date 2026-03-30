import { useCallback } from "react";
import {
  motion,
  type Variants,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  Flame,
  Sparkles,
  TimerReset,
} from "lucide-react";
import { Link } from "react-router-dom";

import PlacePrepLogo from "@/components/PlacePrepLogo";
import { Button } from "@/components/ui/button";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 26, filter: "blur(10px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.88,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const staggerGroup: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.13,
      delayChildren: 0.1,
    },
  },
};

const sections = [
  {
    icon: BrainCircuit,
    eyebrow: "Prep Architect",
    title: "Build your roadmap. Not guess it.",
    copy:
      "PlacePrep generates a structured path from what you already know to what placement pressure still exposes.",
    points: [
      "AI maps a realistic weekly path",
      "Tasks adapt to your weak areas",
    ],
  },
  {
    icon: Bot,
    eyebrow: "Nocturne Mentor",
    title: "Guidance without noise.",
    copy:
      "Ask the hard question, get the sharp answer. No fluff, no overexplaining, no false comfort.",
    points: [
      "Direct mentor responses",
      "Clear hints and next moves",
    ],
  },
  {
    icon: TimerReset,
    eyebrow: "Power Pocket",
    title: "Use time others waste.",
    copy:
      "Capture unexpected free time and convert it into one focused win before the moment slips away.",
    points: [
      "Quick tasks built for short windows",
      "Momentum from spare minutes",
    ],
  },
  {
    icon: Flame,
    eyebrow: "Progress Tracking",
    title: "Track what matters.",
    copy:
      "Measure the signals that actually move placements forward: streak, consistency, readiness, and execution.",
    points: [
      "Streak and consistency tracking",
      "Readiness you can actually watch rise",
    ],
  },
];

const heroSignals = [
  {
    label: "Prep Architect",
    text: "Weak areas mapped into a weekly route.",
  },
  {
    label: "Nocturne Mentor",
    text: "Strict guidance, clean hints, no wasted words.",
  },
  {
    label: "Power Pocket",
    text: "Unexpected 30 minutes turned into visible progress.",
  },
];

const heroPills = ["Private by default", "AI roadmap engine", "No-noise mentoring"];

export default function LandingPage() {
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);

  const smoothX = useSpring(pointerX, { stiffness: 90, damping: 18, mass: 0.45 });
  const smoothY = useSpring(pointerY, { stiffness: 90, damping: 18, mass: 0.45 });

  const heroTranslateX = useTransform(smoothX, [-0.5, 0.5], [-10, 10]);
  const heroTranslateY = useTransform(smoothY, [-0.5, 0.5], [-8, 8]);
  const heroRotateX = useTransform(smoothY, [-0.5, 0.5], [3.5, -3.5]);
  const heroRotateY = useTransform(smoothX, [-0.5, 0.5], [-4.5, 4.5]);
  const glowX = useTransform(smoothX, [-0.5, 0.5], [42, 58]);
  const glowY = useTransform(smoothY, [-0.5, 0.5], [34, 56]);
  const dynamicGlow = useMotionTemplate`radial-gradient(circle at ${glowX}% ${glowY}%, rgba(139,0,0,0.22), transparent 34%)`;

  const handleHeroMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      const offsetX = (event.clientX - bounds.left) / bounds.width - 0.5;
      const offsetY = (event.clientY - bounds.top) / bounds.height - 0.5;

      pointerX.set(offsetX);
      pointerY.set(offsetY);
    },
    [pointerX, pointerY],
  );

  const handleHeroLeave = useCallback(() => {
    pointerX.set(0);
    pointerY.set(0);
  }, [pointerX, pointerY]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      className="relative min-h-screen overflow-hidden bg-background text-foreground"
    >
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-90"
        animate={{
          backgroundPosition: [
            "0% 0%, 100% 0%, 0% 100%",
            "14% 8%, 86% 18%, 8% 88%",
            "0% 0%, 100% 0%, 0% 100%",
          ],
        }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 0%, rgba(139,0,0,0.18), transparent 34%), radial-gradient(circle at 85% 15%, rgba(139,0,0,0.08), transparent 20%), radial-gradient(circle at 10% 85%, rgba(230,230,230,0.04), transparent 18%)",
        }}
      />
      <motion.div
        className="pointer-events-none absolute -left-16 top-[-8rem] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,rgba(139,0,0,0.18),transparent_68%)] blur-3xl"
        animate={{ x: [0, 36, 0], y: [0, 24, 0], scale: [1, 1.08, 1], opacity: [0.22, 0.34, 0.22] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute right-[-10rem] top-[18%] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,rgba(139,0,0,0.12),transparent_70%)] blur-3xl"
        animate={{ x: [0, -42, 0], y: [0, -20, 0], scale: [1.02, 0.94, 1.02], opacity: [0.14, 0.26, 0.14] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] [background-size:120px_120px]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.055] [background-image:radial-gradient(rgba(255,255,255,0.62)_0.55px,transparent_0.6px)] [background-size:14px_14px]" />

      <header className="relative z-10 border-b border-white/6">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <PlacePrepLogo compact />

          <div className="flex items-center gap-3">
            <motion.div whileHover={{ y: -2, scale: 1.02 }} whileTap={{ scale: 0.985 }}>
              <Button
                asChild
                variant="ghost"
                className="rounded-full border border-white/8 bg-white/[0.02] px-5 text-sm text-muted-foreground shadow-[0_0_0_rgba(139,0,0,0)] transition-all duration-500 hover:border-[#8b0000]/35 hover:bg-white/[0.05] hover:text-foreground hover:shadow-[0_0_24px_rgba(139,0,0,0.12)]"
              >
                <Link to="/auth?mode=login">Enter PlacePrep</Link>
              </Button>
            </motion.div>
            <motion.div whileHover={{ y: -2, scale: 1.03 }} whileTap={{ scale: 0.985 }}>
              <Button
                asChild
                className="rounded-full bg-primary px-5 text-sm text-primary-foreground shadow-[0_16px_40px_rgba(139,0,0,0.18)] transition-all duration-500 hover:bg-primary/90 hover:shadow-[0_0_28px_rgba(139,0,0,0.22),0_18px_48px_rgba(139,0,0,0.16)]"
              >
                <Link to="/auth?mode=register">Initialize</Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid min-h-[calc(100vh-76px)] w-full max-w-7xl items-center gap-14 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:py-24">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerGroup}
            className="max-w-3xl"
          >
            <motion.p
              variants={fadeUp}
              className="mb-6 text-[11px] uppercase tracking-[0.42em] text-[#9a9a9a]"
            >
              Private command center for placements
            </motion.p>

            <motion.h1
              variants={fadeUp}
              className="max-w-4xl font-heading text-6xl font-medium leading-[0.92] text-[#e6e6e6] md:text-7xl lg:text-[6.1rem]"
            >
              Discipline builds systems.
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mt-7 max-w-2xl text-lg leading-8 text-[#9a9a9a] md:text-xl"
            >
              PlacePrep is your private command center for placements.
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="mt-10 flex flex-col gap-4 sm:flex-row"
            >
              <motion.div whileHover={{ y: -2, scale: 1.03 }} whileTap={{ scale: 0.985 }}>
                <Button
                  asChild
                  size="lg"
                  className="h-12 rounded-full bg-primary px-8 text-sm uppercase tracking-[0.18em] text-primary-foreground shadow-[0_18px_48px_rgba(139,0,0,0.22)] transition-all duration-500 hover:shadow-[0_0_30px_rgba(139,0,0,0.24),0_20px_50px_rgba(139,0,0,0.18)]"
                >
                  <Link to="/auth?mode=register">
                    Initialize
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </motion.div>

              <motion.div whileHover={{ y: -2, scale: 1.02 }} whileTap={{ scale: 0.985 }}>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-full border-white/10 bg-white/[0.02] px-8 text-sm uppercase tracking-[0.18em] text-[#e6e6e6] transition-all duration-500 hover:border-[#8b0000]/28 hover:bg-white/[0.05] hover:shadow-[0_0_24px_rgba(139,0,0,0.1)]"
                >
                  <Link to="/auth?mode=login">Enter PlacePrep</Link>
                </Button>
              </motion.div>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="mt-12 flex flex-wrap items-center gap-3 text-sm text-[#9a9a9a]"
            >
              {heroPills.map((item, index) => (
                <motion.span
                  key={item}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55 + index * 0.08, duration: 0.55 }}
                  className="rounded-full border border-white/8 bg-white/[0.025] px-4 py-2 transition-all duration-500 hover:border-[#8b0000]/25 hover:bg-white/[0.04]"
                >
                  {item}
                </motion.span>
              ))}
            </motion.div>
          </motion.div>

          <motion.div
            className="relative mx-auto w-full max-w-[34rem] [perspective:1600px]"
            onMouseMove={handleHeroMove}
            onMouseLeave={handleHeroLeave}
          >
            <motion.div
              className="absolute left-1/2 top-1/2 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(139,0,0,0.18),transparent_62%)] blur-3xl"
              animate={{ opacity: [0.28, 0.5, 0.28], scale: [0.96, 1.08, 0.96] }}
              transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut" }}
              style={{ x: heroTranslateX, y: heroTranslateY }}
            />

            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 7.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <motion.div
                initial={{ opacity: 0, y: 28, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
                style={{
                  x: heroTranslateX,
                  y: heroTranslateY,
                  rotateX: heroRotateX,
                  rotateY: heroRotateY,
                  transformStyle: "preserve-3d",
                }}
                className="relative overflow-hidden rounded-[2rem] border border-white/8 bg-[#111116]/95 p-6 shadow-[0_28px_80px_rgba(0,0,0,0.42)] backdrop-blur transition-all duration-500"
              >
                <motion.div
                  className="absolute inset-0 opacity-90"
                  style={{ backgroundImage: dynamicGlow }}
                />
                <motion.div
                  className="absolute inset-0 rounded-[2rem] border border-[#8b0000]/0"
                  animate={{
                    borderColor: [
                      "rgba(139,0,0,0.05)",
                      "rgba(139,0,0,0.18)",
                      "rgba(139,0,0,0.05)",
                    ],
                    boxShadow: [
                      "0 0 0 rgba(139,0,0,0)",
                      "0 0 35px rgba(139,0,0,0.12)",
                      "0 0 0 rgba(139,0,0,0)",
                    ],
                  }}
                  transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                />
                <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/18 to-transparent" />

                <div className="relative">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.35em] text-[#9a9a9a]">
                        Tonight&apos;s directive
                      </p>
                      <p className="mt-3 font-heading text-3xl text-[#e6e6e6]">
                        Hold the line. Close the gap.
                      </p>
                    </div>
                    <motion.div
                      className="rounded-full border border-[#8b0000]/30 bg-[#8b0000]/10 p-3 text-[#d8b2b2]"
                      animate={{ scale: [1, 1.05, 1], opacity: [0.85, 1, 0.85] }}
                      transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <Sparkles className="h-5 w-5" />
                    </motion.div>
                  </div>

                  <div className="mt-8 grid gap-4">
                    {heroSignals.map((item, index) => (
                      <motion.div
                        key={item.label}
                        whileHover={{
                          y: -4,
                          borderColor: "rgba(139,0,0,0.28)",
                          boxShadow: "0 18px 42px rgba(0,0,0,0.22), 0 0 26px rgba(139,0,0,0.08)",
                        }}
                        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                        className="rounded-[1.5rem] border border-white/8 bg-white/[0.025] p-4"
                        style={{
                          transform: `translateZ(${24 + index * 10}px)`,
                        }}
                      >
                        <p className="text-[11px] uppercase tracking-[0.3em] text-[#9a9a9a]">
                          {item.label}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[#e6e6e6]">
                          {item.text}
                        </p>
                      </motion.div>
                    ))}
                  </div>

                  <motion.div
                    whileHover={{
                      y: -4,
                      borderColor: "rgba(139,0,0,0.32)",
                      boxShadow: "0 18px 46px rgba(0,0,0,0.22), 0 0 30px rgba(139,0,0,0.1)",
                    }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className="mt-8 rounded-[1.5rem] border border-white/8 bg-[linear-gradient(135deg,rgba(139,0,0,0.14),rgba(255,255,255,0.02))] p-5"
                    style={{ transform: "translateZ(42px)" }}
                  >
                    <p className="text-[11px] uppercase tracking-[0.32em] text-[#9a9a9a]">
                      Core signal
                    </p>
                    <p className="mt-3 text-base leading-7 text-[#e6e6e6]">
                      A serious prep system should feel private, exact, and hard to ignore.
                    </p>
                  </motion.div>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </section>

        <section className="relative mx-auto w-full max-w-7xl px-6 pb-10 lg:px-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.18 }}
            variants={staggerGroup}
            className="grid gap-6 lg:grid-cols-2"
          >
            {sections.map((section) => {
              const Icon = section.icon;

              return (
                <motion.article
                  key={section.title}
                  variants={fadeUp}
                  whileHover={{
                    y: -8,
                    borderColor: "rgba(139,0,0,0.34)",
                    boxShadow: "0 26px 68px rgba(0,0,0,0.34), 0 0 32px rgba(139,0,0,0.1)",
                  }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="group relative overflow-hidden rounded-[2rem] border border-white/8 bg-[#111116] p-7 shadow-[0_16px_50px_rgba(0,0,0,0.25)]"
                >
                  <motion.div
                    className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,0,0,0.12),transparent_35%)] opacity-0"
                    whileHover={{ opacity: 1 }}
                    transition={{ duration: 0.35 }}
                  />

                  <div className="relative">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-[11px] uppercase tracking-[0.36em] text-[#9a9a9a]">
                        {section.eyebrow}
                      </p>
                      <motion.div
                        whileHover={{ scale: 1.06, borderColor: "rgba(139,0,0,0.28)" }}
                        className="rounded-full border border-white/10 bg-white/[0.03] p-3 text-[#d8d0d0] transition-colors duration-300"
                      >
                        <Icon className="h-4 w-4" />
                      </motion.div>
                    </div>

                    <h2 className="mt-5 max-w-xl font-heading text-4xl font-medium leading-tight text-[#e6e6e6]">
                      {section.title}
                    </h2>

                    <p className="mt-4 max-w-xl text-base leading-7 text-[#9a9a9a]">
                      {section.copy}
                    </p>

                    <div className="mt-8 space-y-3">
                      {section.points.map((point) => (
                        <div key={point} className="flex items-start gap-3">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#8b0000]" />
                          <p className="text-sm leading-6 text-[#e6e6e6]">{point}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </motion.div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-6 py-24 lg:px-10">
          <motion.div
            initial={{ opacity: 0, y: 24, filter: "blur(12px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-[2.4rem] border border-white/8 bg-[#111116] px-8 py-14 text-center shadow-[0_24px_80px_rgba(0,0,0,0.35)] md:px-14"
          >
            <motion.div
              className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(139,0,0,0.16),transparent_36%)]"
              animate={{ opacity: [0.7, 1, 0.7], scale: [1, 1.04, 1] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="relative">
              <p className="text-[11px] uppercase tracking-[0.38em] text-[#9a9a9a]">
                Final call
              </p>
              <h2 className="mx-auto mt-5 max-w-4xl font-heading text-5xl font-medium leading-tight text-[#e6e6e6] md:text-6xl">
                You already know what to do.
              </h2>

              <motion.div
                whileHover={{ y: -2, scale: 1.03 }}
                whileTap={{ scale: 0.985 }}
                className="mx-auto mt-10 w-fit"
              >
                <Button
                  asChild
                  size="lg"
                  className="h-12 rounded-full bg-primary px-8 text-sm uppercase tracking-[0.2em] text-primary-foreground shadow-[0_18px_50px_rgba(139,0,0,0.24)] transition-all duration-500 hover:shadow-[0_0_30px_rgba(139,0,0,0.24),0_22px_60px_rgba(139,0,0,0.18)]"
                >
                  <Link to="/auth?mode=login">
                    Enter PlacePrep
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </section>
      </main>
    </motion.div>
  );
}
