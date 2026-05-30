import { AnimatePresence, motion } from "framer-motion";
import {
  ClipboardList,
  ChevronRight,
  BrainCircuit,
  BellRing,
  Code2,
  LayoutDashboard,
  LineChart,
  ListTodo,
  LogOut,
  Menu,
  MessageSquareText,
  Settings,
  ShieldCheck,
  UserCircle2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink as RouterNavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import PlacePrepLogo from "@/components/PlacePrepLogo";
import PrepIdentityDock, { type PrepIdentityLink } from "@/components/PrepIdentityDock";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import HowItWorksDialog from "@/components/HowItWorksDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/context/AuthContext";
import { useQueryErrorLogger } from "@/hooks/use-query-error-logger";
import { isObserverUser } from "@/lib/access";
import { fetchAiStatus, fetchLatestPrepPlan, fetchUserProfile } from "@/lib/api";
import { isPlacePrepAndroidApp } from "@/lib/platform";

const navItems = [
  { to: "/dashboard", label: "Command Chamber", icon: LayoutDashboard, observerVisible: true },
  { to: "/prep-architect", label: "Prep Architect", icon: BrainCircuit, observerVisible: false },
  { to: "/assessments", label: "Assessments", icon: ClipboardList, observerVisible: false },
  { to: "/coding-lab", label: "Coding Lab", icon: Code2, observerVisible: false },
  { to: "/notifications", label: "Notifications", icon: BellRing, observerVisible: false },
  { to: "/tasks", label: "Tasks", icon: ListTodo, observerVisible: true },
  { to: "/progress", label: "Progress", icon: LineChart, observerVisible: false },
  { to: "/admin-console", label: "Admin Console", icon: ShieldCheck, observerVisible: false, adminOnly: true },
  { to: "/ai-mentor", label: "Nocturne Mentor", icon: MessageSquareText, observerVisible: true },
  { to: "/settings", label: "Settings", icon: Settings, observerVisible: false },
  { to: "/profile", label: "Profile", icon: UserCircle2, observerVisible: false },
];

const ONBOARDING_STORAGE_KEY = "placeprep.onboarding.v1";

const pageMeta: Record<string, { title: string; description: string }> = {
  "/dashboard": {
    title: "Command Chamber",
    description: "Clock. Focus. Execute.",
  },
  "/prep-architect": {
    title: "Prep Architect",
    description: "Map. Practice. Recall.",
  },
  "/tasks": {
    title: "Mission Control",
    description: "Queue. Strike. Clear.",
  },
  "/assessments": {
    title: "Assessments",
    description: "Probe. Measure. Adapt.",
  },
  "/coding-lab": {
    title: "Coding Lab",
    description: "Run. Score. Submit.",
  },
  "/notifications": {
    title: "Notifications",
    description: "Pulse. Deliver. Act.",
  },
  "/progress": {
    title: "Progress Intel",
    description: "Signal. Drift. Recover.",
  },
  "/admin-console": {
    title: "Admin Console",
    description: "Invite. Group. Assign.",
  },
  "/profile": {
    title: "Profile",
    description: "Presence. Craft. Proof.",
  },
  "/settings": {
    title: "Settings",
    description: "Tune. Save. Return.",
  },
  "/ai-mentor": {
    title: "Nocturne Mentor",
    description: "Ask. Refine. Advance.",
  },
};

function resolveMeta(pathname: string) {
  if (pathname.startsWith("/coding-lab")) {
    return pageMeta["/coding-lab"];
  }

  return pageMeta[pathname] || pageMeta["/dashboard"];
}

interface ShellSidebarProps {
  currentPath: string;
  aiLive: boolean;
  aiReason: string;
  planVersion?: number | null;
  planFocus?: string | null;
  navItems: typeof navItems;
  onNavigate?: () => void;
}

function ShellSidebar({
  currentPath,
  aiLive,
  aiReason,
  planVersion,
  planFocus,
  navItems: visibleNavItems,
  onNavigate,
}: ShellSidebarProps) {
  return (
    <div className="flex h-full flex-col bg-[linear-gradient(180deg,hsl(240_13%_5%),hsl(240_14%_4%))]">
      <div className="border-b border-sidebar-border/70 px-5 py-5">
        <PlacePrepLogo compact />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-5">
        <div>
          <p className="px-2 text-xs uppercase tracking-[0.24em] text-sidebar-foreground/55">Navigate</p>
          <nav className="mt-3 space-y-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.to || (item.to === "/coding-lab" && currentPath.startsWith("/coding-lab"));

              return (
                <RouterNavLink
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-sm transition ${
                    isActive
                      ? "border-primary/40 bg-primary/10 text-foreground shadow-[0_0_28px_hsl(0_55%_33%_/_0.08)]"
                      : "border-transparent text-sidebar-foreground/78 hover:border-sidebar-border/70 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </RouterNavLink>
              );
            })}
          </nav>
        </div>

        <div className="mt-8 border-t border-sidebar-border/70 pt-8">
          <p className="px-2 text-xs uppercase tracking-[0.24em] text-sidebar-foreground/55">Signals</p>
          <div className="mt-3 rounded-2xl border border-sidebar-border/80 bg-sidebar-accent/60 p-4 text-sm text-sidebar-foreground/80">
            <p className="text-[11px] uppercase tracking-[0.24em] text-sidebar-foreground/55">AI status</p>
            <p className="mt-2 font-heading text-3xl text-sidebar-foreground">{aiLive ? "Live" : "Fallback"}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-sidebar-foreground/55">
              {aiReason}
            </p>
            <p className="mt-4 text-xs leading-5 text-sidebar-foreground/65">
              {planVersion
                ? `Architect v${planVersion} focused on ${planFocus || "your next topic"}.`
                : "No active architect plan yet. Build one to give the coach a structure to push against."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function getAvatarFallbackLabel(name?: string | null, username?: string | null) {
  const source = (name || username || "PlacePrep User").trim();
  const initials = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

  return initials || "PP";
}

export default function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isDemoMode } = useAuth();
  const meta = resolveMeta(location.pathname);
  const runningInsideAndroidApp = isPlacePrepAndroidApp();

  const aiStatusQuery = useQuery({
    queryKey: ["ai-status"],
    queryFn: fetchAiStatus,
    enabled: !runningInsideAndroidApp,
  });
  const profileQuery = useQuery({
    queryKey: ["user-profile"],
    queryFn: fetchUserProfile,
    enabled: !runningInsideAndroidApp,
  });
  const prepPlanQuery = useQuery({
    queryKey: ["prep-plan", "latest"],
    queryFn: fetchLatestPrepPlan,
    enabled: !runningInsideAndroidApp,
  });

  useQueryErrorLogger("AppShell:ai-status", aiStatusQuery.error);
  useQueryErrorLogger("AppShell:user-profile", profileQuery.error);
  useQueryErrorLogger("AppShell:prep-plan", prepPlanQuery.error);

  const profile = profileQuery.data;
  const aiStatus = aiStatusQuery.data;
  const latestPlan = prepPlanQuery.data;
  const observerMode = isObserverUser(user);
  const avatarFallback = getAvatarFallbackLabel(user?.name, user?.username);
  const visibleNavItems = (observerMode ? navItems.filter((item) => item.observerVisible) : navItems)
    .filter((item) => !item.adminOnly || user?.role === "admin");
  const identityLinks = [
    { href: profile?.linkedinUrl, label: "LinkedIn", kind: "linkedin" },
    { href: profile?.githubUrl, label: "GitHub", kind: "github" },
    { href: profile?.leetcodeUrl, label: "LeetCode", kind: "leetcode" },
    { href: profile?.portfolioUrl, label: "Portfolio", kind: "portfolio" },
    { href: profile?.resumeUrl, label: "Resume", kind: "resume" },
  ].filter((item): item is PrepIdentityLink => Boolean(item.href));

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.localStorage.getItem(ONBOARDING_STORAGE_KEY)) {
      return;
    }

    setHowItWorksOpen(true);
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "seen");
  }, []);

  return (
    <div
      className={`relative min-h-screen bg-background ${
        runningInsideAndroidApp ? "overflow-x-hidden" : "vignette overflow-hidden"
      }`}
    >
      <div
        className={`pointer-events-none absolute inset-0 ${
          runningInsideAndroidApp
            ? "bg-[radial-gradient(circle_at_top,hsl(0_55%_33%_/_0.08),transparent_30%),linear-gradient(180deg,hsl(240_14%_5%),hsl(240_15%_4%))]"
            : "bg-[radial-gradient(circle_at_top_left,hsl(0_55%_33%_/_0.14),transparent_26%),radial-gradient(circle_at_90%_15%,hsl(38_40%_38%_/_0.08),transparent_25%)]"
        }`}
      />

      <div className="relative z-10 flex min-h-screen w-full">
        {!runningInsideAndroidApp && (
          <aside className="hidden w-[268px] shrink-0 border-r border-sidebar-border/80 md:flex md:flex-col">
            <ShellSidebar
              currentPath={location.pathname}
              aiLive={Boolean(aiStatus?.aiEnabled)}
              aiReason={aiStatusQuery.isPending ? "checking" : aiStatus?.reason || "offline"}
              planVersion={latestPlan?.version}
              planFocus={latestPlan?.targetTopics?.[0] || null}
              navItems={visibleNavItems}
            />
          </aside>
        )}

        {!runningInsideAndroidApp && (
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetContent side="left" className="w-[290px] border-r border-sidebar-border/80 bg-[hsl(240_13%_5%)] p-0">
              <ShellSidebar
                currentPath={location.pathname}
                aiLive={Boolean(aiStatus?.aiEnabled)}
                aiReason={aiStatusQuery.isPending ? "checking" : aiStatus?.reason || "offline"}
                planVersion={latestPlan?.version}
                planFocus={latestPlan?.targetTopics?.[0] || null}
                navItems={visibleNavItems}
                onNavigate={() => setMobileNavOpen(false)}
              />
            </SheetContent>
          </Sheet>
        )}

        <main className="min-w-0 flex-1">
          {!runningInsideAndroidApp && (
            <header className="sticky top-0 z-20 border-b border-border/60 bg-background/75 backdrop-blur">
              <div className="flex w-full items-center gap-4 px-4 py-4 md:px-8 xl:px-10">
                <div className="min-w-0 flex flex-1 items-center gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full border border-border/80 bg-background/60 md:hidden"
                    onClick={() => setMobileNavOpen(true)}
                  >
                    <Menu className="h-4 w-4" />
                    <span className="sr-only">Open navigation</span>
                  </Button>
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
                      PlacePrep
                    </p>
                    <h1 className="truncate font-heading text-3xl text-foreground md:text-4xl">{meta.title}</h1>
                  </div>
                </div>

                <div className="ml-auto flex shrink-0 items-center gap-2 md:gap-3">
                  <div className="hidden xl:flex rounded-full border border-border/80 bg-background/70 px-3 py-1.5 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    {meta.description}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="hidden rounded-full border border-border/80 bg-background/70 px-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground md:inline-flex"
                    onClick={() => setHowItWorksOpen(true)}
                  >
                    How it works
                  </Button>
                  <div
                    className={`hidden rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.18em] sm:flex ${
                      aiStatus?.aiEnabled
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border/80 bg-background/70 text-muted-foreground"
                    }`}
                  >
                    {aiStatusQuery.isPending ? "Checking" : aiStatus?.aiEnabled ? "AI live" : "Fallback"}
                  </div>
                  {isDemoMode && (
                    <div className="hidden rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-primary md:flex">
                      Demo mode
                    </div>
                  )}
                  {identityLinks.length > 0 && (
                    <div className="hidden md:block">
                      <PrepIdentityDock links={identityLinks} />
                    </div>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="Open profile menu"
                        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/80 bg-card/65 p-1.5 shadow-[0_14px_40px_hsl(240_20%_2%_/_0.18)] transition hover:border-primary/30 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <Avatar className="h-full w-full border border-border/50">
                          <AvatarImage src={profile?.avatarUrl || undefined} alt={user?.name || "Profile"} />
                          <AvatarFallback className="bg-primary/15 text-xs font-medium tracking-[0.12em] text-foreground">
                            {avatarFallback}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-64 rounded-[1.25rem] border-border/80 bg-card/95 p-2 text-foreground shadow-[0_20px_60px_hsl(240_20%_2%_/_0.34)] backdrop-blur"
                    >
                      <DropdownMenuLabel className="rounded-[0.95rem] px-3 py-3">
                        <p className="text-sm text-foreground">{user?.name || "PlacePrep user"}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          @{user?.username || "set-username"}
                        </p>
                        {observerMode && (
                          <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                            Observer access
                          </p>
                        )}
                      </DropdownMenuLabel>
                      {!observerMode && (
                        <>
                          <DropdownMenuSeparator className="bg-border/80" />
                          <DropdownMenuItem
                            className="rounded-xl px-3 py-2.5 text-sm"
                            onSelect={() => navigate("/settings")}
                          >
                            <Settings className="mr-2 h-4 w-4" />
                            Settings
                            <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuSeparator className="bg-border/80" />
                      <DropdownMenuItem
                        className="rounded-xl px-3 py-2.5 text-sm text-destructive focus:bg-destructive/10 focus:text-destructive"
                        onSelect={() => logout()}
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </header>
          )}

          <div
            className={`w-full min-w-0 ${
              runningInsideAndroidApp ? "px-3 pb-6 pt-3" : "px-4 pb-10 pt-6 md:px-8 xl:px-10"
            }`}
          >
            <RouteErrorBoundary resetKey={location.pathname}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={location.pathname}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.24 }}
                  className="min-w-0"
                >
                  <Outlet />
                </motion.div>
              </AnimatePresence>
            </RouteErrorBoundary>
          </div>
        </main>
      </div>

      <HowItWorksDialog open={howItWorksOpen} onOpenChange={setHowItWorksOpen} />
    </div>
  );
}
