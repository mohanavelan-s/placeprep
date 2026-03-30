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
  login: (payload: { identifier: string; password: string }) => Promise<AuthResult>;
  register: (payload: RegisterInput) => Promise<AuthResult>;
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
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        clearStoredSession();
        setToken(null);
        setUser(null);
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
    async login(payload) {
      const session = await loginRequest(payload);
      queryClient.clear();
      applySession(session, setToken, setUser);
      return session;
    },
    async register(payload) {
      const session = await registerRequest(payload);
      queryClient.clear();
      applySession(session, setToken, setUser);
      return session;
    },
    logout() {
      clearStoredSession();
      setToken(null);
      setUser(null);
      queryClient.clear();
    },
    async refreshProfile() {
      const profile = await fetchProfile();
      window.localStorage.setItem("placeprep.user", JSON.stringify(profile));
      setUser(profile);
      return profile;
    },
  }), [isInitializing, queryClient, token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
