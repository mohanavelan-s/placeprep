import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, Lock, ShieldCheck, UserPlus, UserRound } from "lucide-react";
import { toast } from "sonner";

import { useQueryErrorLogger } from "@/hooks/use-query-error-logger";
import { fetchInvitePreview } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface AuthPanelProps {
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
  initialMode?: "login" | "register";
  initialInviteCode?: string;
}

export default function AuthPanel({
  onLogin,
  onRegister,
  onEnterDemo,
  initialMode = "login",
  initialInviteCode = "",
}: AuthPanelProps) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginForm, setLoginForm] = useState({
    identifier: "",
    password: "",
  });
  const [registerForm, setRegisterForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    inviteCode: initialInviteCode,
    targetRole: "Backend Engineer",
    placementDate: "",
    weakAreas: "Dynamic Programming, Operating Systems, System Design",
  });

  const invitePreviewQuery = useQuery({
    queryKey: ["invite-preview", registerForm.inviteCode.trim()],
    queryFn: () => fetchInvitePreview(registerForm.inviteCode.trim()),
    enabled: mode === "register" && registerForm.inviteCode.trim().length > 0,
    retry: false,
  });

  useQueryErrorLogger("AuthPanel:invite-preview", invitePreviewQuery.error);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    setRegisterForm((current) => ({ ...current, inviteCode: initialInviteCode }));
  }, [initialInviteCode]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await onLogin(loginForm);
      toast.success("Signed in to PlacePrep.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await onRegister({
        name: registerForm.name,
        username: registerForm.username || undefined,
        email: registerForm.email,
        password: registerForm.password,
        inviteCode: registerForm.inviteCode || undefined,
        targetRole: registerForm.targetRole || undefined,
        placementDate: registerForm.placementDate || undefined,
        weakAreas: registerForm.weakAreas
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      });
      toast.success("Account created and signed in.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create account.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const inviteCodeValue = registerForm.inviteCode.trim();
  const invitePreview = invitePreviewQuery.data;
  const inviteIsValid = Boolean(invitePreview?.valid);
  const inviteRoleLabel = invitePreview?.role === "observer"
    ? "Observer"
    : invitePreview?.role
      ? invitePreview.role[0].toUpperCase() + invitePreview.role.slice(1)
      : "";
  const registerDisabled =
    isSubmitting
    || !inviteCodeValue
    || invitePreviewQuery.isFetching
    || invitePreviewQuery.isError
    || (invitePreviewQuery.isFetched && !inviteIsValid);

  return (
    <div className="min-h-screen bg-background vignette relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(0_55%_33%_/_0.12),transparent_35%),radial-gradient(circle_at_bottom_right,hsl(38_40%_38%_/_0.12),transparent_30%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-10 px-6 py-10 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-8"
        >
          <div className="space-y-4">
            <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
              PlacePrep access
            </p>
            <h1 className="max-w-2xl font-heading text-5xl font-light leading-none text-foreground md:text-7xl">
              Enter the system and keep the work exact.
            </h1>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground md:text-base">
              Your roadmap, mentor, progress signals, and task engine stay behind one private
              entrance built for consistent placement prep.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Live auth",
                copy: "JWT-backed sign in and invite-gated registration against the running API.",
              },
              {
                title: "Private workspace",
                copy: "Your plan, your mentor, your progress signals in one focused system.",
              },
              {
                title: "Tracked work",
                copy: "Tasks, streaks, and readiness are stored and updated in real time.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-[1.65rem] border border-border/70 bg-gradient-surface p-5"
              >
                <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  {item.title}
                </p>
                <p className="text-sm text-foreground/75">{item.copy}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.7 }}
        >
          <Card className="border-border/70 bg-gradient-surface shadow-[0_0_40px_hsl(0_55%_33%_/_0.08)]">
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="font-heading text-4xl font-light">
                    {mode === "login" ? "Welcome back" : "Create your workspace"}
                  </CardTitle>
                  <CardDescription className="mt-2 max-w-sm text-sm leading-6">
                    {mode === "login"
                      ? "Sign in to your PlacePrep workspace and resume where your system left off."
                      : "Create your PlacePrep identity and begin with a live workspace."}
                  </CardDescription>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-[1.35rem] border border-border/70 bg-background/40 p-1">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className={`rounded-[1rem] px-4 py-2 text-sm transition ${
                    mode === "login"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className={`rounded-[1rem] px-4 py-2 text-sm transition ${
                    mode === "register"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Register
                </button>
              </div>
            </CardHeader>

            <CardContent>
              {mode === "login" ? (
                <form className="space-y-4" onSubmit={handleLogin}>
                  <label className="block space-y-2">
                    <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                      Username or email
                    </span>
                    <Input
                      value={loginForm.identifier}
                      onChange={(event) =>
                        setLoginForm((current) => ({ ...current, identifier: event.target.value }))
                      }
                      placeholder="demo or you@example.com"
                      required
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                      Password
                    </span>
                    <Input
                      type="password"
                      value={loginForm.password}
                      onChange={(event) =>
                        setLoginForm((current) => ({ ...current, password: event.target.value }))
                      }
                      placeholder="Enter your password"
                      required
                    />
                  </label>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full justify-center gap-2"
                    disabled={isSubmitting}
                  >
                    <Lock className="h-4 w-4" />
                    {isSubmitting ? "Signing in..." : "Sign in"}
                  </Button>
                </form>
              ) : (
                <form className="space-y-4" onSubmit={handleRegister}>
                  <label className="block space-y-2">
                    <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                      Invite code
                    </span>
                    <Input
                      value={registerForm.inviteCode}
                      onChange={(event) =>
                        setRegisterForm((current) => ({ ...current, inviteCode: event.target.value }))
                      }
                      placeholder="ENTER-YOUR-INVITE"
                      required
                    />
                  </label>

                  <div className="rounded-[1.15rem] border border-border/70 bg-background/45 px-4 py-3 text-sm">
                    {invitePreviewQuery.isFetching ? (
                      <p className="text-muted-foreground">Validating invite access...</p>
                    ) : invitePreviewQuery.isError ? (
                      <p className="text-destructive">Invite validation failed. Retry or check the code.</p>
                    ) : inviteCodeValue && invitePreview ? (
                      <div className="space-y-1">
                        <p className={invitePreview.valid ? "text-foreground" : "text-destructive"}>
                          {invitePreview.message}
                        </p>
                        {invitePreview.valid && (
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                            Role: {inviteRoleLabel}
                            {invitePreview.role === "observer"
                              ? " / Limited to command chamber, tasks, and mentor."
                              : ` / Expires: ${new Date(invitePreview.expiresAt || "").toLocaleDateString("en-IN")}`}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">
                        Public signup is disabled. Access is granted through an invite code.
                      </p>
                    )}
                  </div>

                  <label className="block space-y-2">
                    <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                      Full name
                    </span>
                    <Input
                      value={registerForm.name}
                      onChange={(event) =>
                        setRegisterForm((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder="Aspirant name"
                      required
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Email
                      </span>
                      <Input
                        type="email"
                        value={registerForm.email}
                        onChange={(event) =>
                          setRegisterForm((current) => ({ ...current, email: event.target.value }))
                        }
                        placeholder="you@example.com"
                        required
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Username
                      </span>
                      <Input
                        value={registerForm.username}
                        onChange={(event) =>
                          setRegisterForm((current) => ({ ...current, username: event.target.value }))
                        }
                        placeholder="your-handle"
                        minLength={3}
                        maxLength={60}
                        pattern="^[a-zA-Z0-9._-]{3,60}$"
                        title="Use 3 to 60 letters, numbers, dot, underscore, or hyphen."
                      />
                      <p className="text-xs text-muted-foreground">
                        3 to 60 characters. Letters, numbers, dot, underscore, or hyphen only.
                      </p>
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Password
                      </span>
                      <Input
                        type="password"
                        value={registerForm.password}
                        onChange={(event) =>
                          setRegisterForm((current) => ({ ...current, password: event.target.value }))
                        }
                        placeholder="Minimum 8 characters"
                        required
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Target role
                      </span>
                      <Input
                        value={registerForm.targetRole}
                        onChange={(event) =>
                          setRegisterForm((current) => ({ ...current, targetRole: event.target.value }))
                        }
                        placeholder="Backend Engineer"
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Placement date
                      </span>
                      <Input
                        type="date"
                        value={registerForm.placementDate}
                        onChange={(event) =>
                          setRegisterForm((current) => ({ ...current, placementDate: event.target.value }))
                        }
                      />
                    </label>
                  </div>

                  <label className="block space-y-2">
                    <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                      Weak areas
                    </span>
                    <Input
                      value={registerForm.weakAreas}
                      onChange={(event) =>
                        setRegisterForm((current) => ({ ...current, weakAreas: event.target.value }))
                      }
                      placeholder="Dynamic Programming, DBMS, OS"
                    />
                  </label>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full justify-center gap-2"
                    disabled={registerDisabled}
                  >
                    <UserPlus className="h-4 w-4" />
                    {isSubmitting ? "Creating account..." : "Create account"}
                  </Button>
                </form>
              )}

              <div className="mt-6 rounded-[1.35rem] border border-border/70 bg-background/40 p-4 text-sm text-muted-foreground">
                <div className="mb-2 flex items-center gap-2 text-foreground/80">
                  <KeyRound className="h-4 w-4 text-primary" />
                  Private session
                </div>
                <p>
                  PlacePrep keeps your authenticated session active so your command center is ready
                  when you return.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button type="button" variant="outline" className="gap-2 border-border/80 bg-background/60" onClick={() => onEnterDemo("user")}>
                    <UserRound className="h-4 w-4" />
                    User demo
                  </Button>
                  <Button type="button" variant="outline" className="gap-2 border-border/80 bg-background/60" onClick={() => onEnterDemo("admin")}>
                    <ShieldCheck className="h-4 w-4" />
                    Admin demo
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
