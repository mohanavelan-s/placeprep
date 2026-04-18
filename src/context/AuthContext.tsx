import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  clearStoredSession,
  fetchProfile,
  getStoredToken,
  getStoredUser,
  login as loginRequest,
  persistSession,
  register as registerRequest,
  type AuthResult,
  type User,
} from "@/lib/api";
import { activateDemoMode, isDemoModeEnabled } from "@/lib/demo-mode";

interface RegisterInput {
  name: string;
  username?: string;
  email: string;
  password: string;
  inviteCode?: string;
  weakAreas?: string[];
  targetRole?: string;
  placementDate?: string;
}

interface AuthContextValue {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  isDemoMode: boolean;
  login: (payload: { identifier: string; password: string }) => Promise<AuthResult>;
  register: (payload: RegisterInput) => Promise<AuthResult>;
  enterDemoMode: () => AuthResult;
  logout: () => void;
  refreshProfile: () => Promise<User>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function applySession(session: AuthResult, setToken: (token: string) => void, setUser: (user: User) => void) {
  persistSession(session);
  setToken(session.token);
  setUser(session.user);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [isInitializing, setIsInitializing] = useState(Boolean(getStoredToken()));
  const [isDemoMode, setIsDemoMode] = useState(() => isDemoModeEnabled());

  useEffect(() => {
    if (!token) {
      setIsInitializing(false);
      return;
    }

    let cancelled = false;

    fetchProfile()
      .then((profile) => {
        if (cancelled) {
          return;
        }

        window.localStorage.setItem("placeprep.user", JSON.stringify(profile));
        setUser(profile);
        setIsDemoMode(isDemoModeEnabled());
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        clearStoredSession();
        setToken(null);
        setUser(null);
        setIsDemoMode(false);
        queryClient.clear();
      })
      .finally(() => {
        if (!cancelled) {
          setIsInitializing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [queryClient, token]);

  const value = useMemo<AuthContextValue>(() => ({
    token,
    user,
    isAuthenticated: Boolean(token && user),
    isInitializing,
    isDemoMode,
    async login(payload) {
      const session = await loginRequest(payload);
      clearStoredSession();
      queryClient.clear();
      applySession(session, setToken, setUser);
      setIsDemoMode(false);
      return session;
    },
    async register(payload) {
      const session = await registerRequest(payload);
      clearStoredSession();
      queryClient.clear();
      applySession(session, setToken, setUser);
      setIsDemoMode(false);
      return session;
    },
    enterDemoMode() {
      const session = activateDemoMode();
      queryClient.clear();
      applySession(session, setToken, setUser);
      setIsDemoMode(true);
      return session;
    },
    logout() {
      clearStoredSession();
      setToken(null);
      setUser(null);
      setIsDemoMode(false);
      queryClient.clear();
    },
    async refreshProfile() {
      const profile = await fetchProfile();
      window.localStorage.setItem("placeprep.user", JSON.stringify(profile));
      setUser(profile);
      setIsDemoMode(isDemoModeEnabled());
      return profile;
    },
  }), [isDemoMode, isInitializing, queryClient, token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
