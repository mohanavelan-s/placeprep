import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import AppShell from "@/components/AppShell";
import BrowserNotificationBridge from "@/components/BrowserNotificationBridge";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import AiMentorPage from "./pages/AiMentorPage.tsx";
import AuthPage from "./pages/AuthPage.tsx";
import DashboardPage from "./pages/DashboardPage.tsx";
import LandingPage from "./pages/LandingPage.tsx";
import NotFound from "./pages/NotFound.tsx";
import PrepArchitectPage from "./pages/PrepArchitectPage.tsx";
import ProfilePage from "./pages/ProfilePage.tsx";
import ProgressPage from "./pages/ProgressPage.tsx";
import SettingsPage from "./pages/SettingsPage.tsx";
import TasksPage from "./pages/TasksPage.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
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

function AppRoutes() {
  const { isAuthenticated, isInitializing, login, register } = useAuth();

  if (isInitializing) {
    return <LoadingState />;
  }

  if (!isAuthenticated) {
    return (
      <>
        <TitleUpdater />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/welcome" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage onLogin={login} onRegister={register} />} />
          <Route path="/invite" element={<AuthPage onLogin={login} onRegister={register} />} />
          <Route path="/dashboard" element={<Navigate to="/auth?mode=login" replace />} />
          <Route path="/prep-architect" element={<Navigate to="/auth?mode=login" replace />} />
          <Route path="/tasks" element={<Navigate to="/auth?mode=login" replace />} />
          <Route path="/progress" element={<Navigate to="/auth?mode=login" replace />} />
          <Route path="/profile" element={<Navigate to="/auth?mode=login" replace />} />
          <Route path="/settings" element={<Navigate to="/auth?mode=login" replace />} />
          <Route path="/ai-mentor" element={<Navigate to="/auth?mode=login" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </>
    );
  }

  return (
    <>
      <TitleUpdater />
      <BrowserNotificationBridge />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/welcome" element={<LandingPage />} />
        <Route path="/auth" element={<Navigate to="/dashboard" replace />} />
        <Route path="/invite" element={<Navigate to="/dashboard" replace />} />
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/prep-architect" element={<PrepArchitectPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/ai-mentor" element={<AiMentorPage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
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
