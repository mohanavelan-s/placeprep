import { Link, useLocation, useSearchParams } from "react-router-dom";

import AuthPanel from "@/components/AuthPanel";
import PlacePrepLogo from "@/components/PlacePrepLogo";

interface AuthPageProps {
  onLogin: (payload: { identifier: string; password: string }) => Promise<unknown>;
  onRegister: (payload: {
    name: string;
    username?: string;
    email: string;
    password: string;
    inviteCode?: string;
    targetRole?: string;
    placementDate?: string;
    weakAreas?: string[];
  }) => Promise<unknown>;
  onEnterDemo: (role: "admin" | "user") => void;
}

export default function AuthPage({ onLogin, onRegister, onEnterDemo }: AuthPageProps) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const requestedMode = searchParams.get("mode");
  const initialInviteCode = searchParams.get("code") || "";
  const initialMode =
    location.pathname === "/invite" || requestedMode === "register" ? "register" : "login";

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20">
        <div className="pointer-events-auto mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
          <PlacePrepLogo compact />
          <Link
            to="/welcome"
            className="rounded-full border border-white/8 bg-white/[0.02] px-4 py-2 text-xs uppercase tracking-[0.24em] text-[#9a9a9a] transition hover:bg-white/[0.05] hover:text-[#e6e6e6]"
          >
            Back
          </Link>
        </div>
      </div>

      <AuthPanel
        onLogin={onLogin}
        onRegister={onRegister}
        onEnterDemo={onEnterDemo}
        initialMode={initialMode}
        initialInviteCode={initialInviteCode}
      />
    </div>
  );
}
