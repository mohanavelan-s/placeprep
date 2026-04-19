import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import BrowserNotificationBridge from "@/components/BrowserNotificationBridge";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { canAccessAppPath } from "@/lib/access";

const AppShell = lazy(() => import("@/components/AppShell"));
const AssessmentsPage = lazy(() => import("./pages/AssessmentsPage.tsx"));
const AiMentorPage = lazy(() => import("./pages/AiMentorPage.tsx"));
const AuthPage = lazy(() => import("./pages/AuthPage.tsx"));
const DashboardPage = lazy(() => import("./pages/DashboardPage.tsx"));
const LandingPage = lazy(() => import("./pages/LandingPage.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const PrepArchitectPage = lazy(() => import("./pages/PrepArchitectPage.tsx"));
const ProfilePage = lazy(() => import("./pages/ProfilePage.tsx"));
const ProgressPage = lazy(() => import("./pages/ProgressPage.tsx"));
const SettingsPage = lazy(() => import("./pages/SettingsPage.tsx"));
const TasksPage = lazy(() => import("./pages/TasksPage.tsx"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    },
  },
});

function LoadingState() {
  return (
    <div className="min-h-screen bg-background vignette relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(0_55%_33%_/_0.12),transparent_35%)]" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
          Loading workspace
        </p>
        <h1 className="font-heading text-5xl font-light text-foreground">
          Restoring your PlacePrep session.
        </h1>
      </div>
    </div>
  );
}

function TitleUpdater() {
  const location = useLocation();

  useEffect(() => {
    const pageNameMap: Record<string, string> = {
      "/": "PlacePrep",
      "/welcome": "PlacePrep",
      "/auth": "Enter PlacePrep",
      "/invite": "Invite Access",
      "/dashboard": "Command Chamber",
      "/prep-architect": "Prep Architect",
      "/assessments": "Assessments",
      "/tasks": "Mission Control",
      "/progress": "Progress Intel",
      "/profile": "Profile",
      "/settings": "Settings",
      "/ai-mentor": "Nocturne Mentor",
    };
    const pageName = pageNameMap[location.pathname] || "PlacePrep";

    document.title = `${pageName} | PlacePrep`;
  }, [location.pathname]);

  return null;
}

function RestrictedAccessRedirect() {
  return <Navigate to="/dashboard" replace />;
}

function ProtectedWorkspaceLayout() {
  const { user } = useAuth();
  const location = useLocation();

  if (!canAccessAppPath(user, location.pathname)) {
    return <RestrictedAccessRedirect />;
  }

  return <AppShell />;
}

function AppRoutes() {
  const { isAuthenticated, isInitializing, login, register, enterDemoMode } = useAuth();

  if (isInitializing) {
    return <LoadingState />;
  }

  if (!isAuthenticated) {
    return (
      <>
        <TitleUpdater />
        <Suspense fallback={<LoadingState />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/welcome" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage onLogin={login} onRegister={register} onEnterDemo={enterDemoMode} />} />
            <Route path="/invite" element={<AuthPage onLogin={login} onRegister={register} onEnterDemo={enterDemoMode} />} />
            <Route path="/dashboard" element={<Navigate to="/auth?mode=login" replace />} />
            <Route path="/prep-architect" element={<Navigate to="/auth?mode=login" replace />} />
            <Route path="/tasks" element={<Navigate to="/auth?mode=login" replace />} />
            <Route path="/assessments" element={<Navigate to="/auth?mode=login" replace />} />
            <Route path="/progress" element={<Navigate to="/auth?mode=login" replace />} />
            <Route path="/profile" element={<Navigate to="/auth?mode=login" replace />} />
            <Route path="/settings" element={<Navigate to="/auth?mode=login" replace />} />
            <Route path="/ai-mentor" element={<Navigate to="/auth?mode=login" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </>
    );
  }

  return (
    <>
      <TitleUpdater />
      <BrowserNotificationBridge />
      <Suspense fallback={<LoadingState />}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/welcome" element={<LandingPage />} />
          <Route path="/auth" element={<Navigate to="/dashboard" replace />} />
          <Route path="/invite" element={<Navigate to="/dashboard" replace />} />
          <Route element={<ProtectedWorkspaceLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/prep-architect" element={<PrepArchitectPage />} />
            <Route path="/assessments" element={<AssessmentsPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/ai-mentor" element={<AiMentorPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <RouteErrorBoundary resetKey="app-root">
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </RouteErrorBoundary>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
