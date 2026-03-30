import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, Code2, Github, Globe2, Linkedin, Loader2, Save } from "lucide-react";

import ResumeSigilIcon from "@/components/ResumeSigilIcon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { UserProfile } from "@/lib/api";

interface PersonalProfilePanelProps {
  profile?: UserProfile | null;
  displayName?: string;
  isSaving?: boolean;
  onSave: (payload: {
    linkedinUrl?: string;
    githubUrl?: string;
    leetcodeUrl?: string;
    portfolioUrl?: string;
    resumeUrl?: string;
    avatarUrl?: string;
  }) => Promise<unknown>;
  onUploadAvatar: (file: File) => Promise<string>;
  isUploadingAvatar?: boolean;
}

export default function PersonalProfilePanel({
  profile,
  displayName,
  isSaving = false,
  onSave,
  onUploadAvatar,
  isUploadingAvatar = false,
}: PersonalProfilePanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({
    linkedinUrl: "",
    githubUrl: "",
    leetcodeUrl: "",
    portfolioUrl: "",
    resumeUrl: "",
    avatarUrl: "",
  });

  useEffect(() => {
    setForm({
      linkedinUrl: profile?.linkedinUrl || "",
      githubUrl: profile?.githubUrl || "",
      leetcodeUrl: profile?.leetcodeUrl || "",
      portfolioUrl: profile?.portfolioUrl || "",
      resumeUrl: profile?.resumeUrl || "",
      avatarUrl: profile?.avatarUrl || "",
    });
  }, [profile]);

  const profileInitials = useMemo(() => {
    const nameSource = (displayName || "PlacePrep").trim();
    return nameSource
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((chunk) => chunk[0]?.toUpperCase() || "")
      .join("") || "PP";
  }, [displayName]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await onSave(form);
    } catch (error) {
      console.error("[PersonalProfilePanel] Failed to save personal profile.", error);
    }
  }

  async function handleAvatarSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const avatarUrl = await onUploadAvatar(file);
      setForm((current) => ({ ...current, avatarUrl }));
    } catch (error) {
      console.error("[PersonalProfilePanel] Avatar upload failed.", error);
    } finally {
      event.target.value = "";
    }
  }

  const links = [
    { label: "LinkedIn", value: profile?.linkedinUrl, icon: Linkedin },
    { label: "GitHub", value: profile?.githubUrl, icon: Github },
    { label: "LeetCode", value: profile?.leetcodeUrl, icon: Code2 },
    { label: "Portfolio", value: profile?.portfolioUrl, icon: Globe2 },
    { label: "Resume", value: profile?.resumeUrl, icon: ResumeSigilIcon },
  ].filter((item) => item.value);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18, duration: 0.7 }}
      className="surface-panel p-6 md:p-7"
    >
      <div className="mb-6">
        <p className="section-label">Personal Profile</p>
        <h3 className="mt-2 font-heading text-3xl font-medium text-foreground">
          Keep your prep identity in one place.
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 body-secondary">
          Save your profile icon and core prep links so PlacePrep can keep your command surface and identity context aligned.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
          <div className="rounded-[1.65rem] border border-border/80 bg-background/55 p-5 shadow-[inset_0_1px_0_hsl(0_0%_100%_/_0.03)]">
            <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Profile icon</p>
            <div className="mt-6 flex flex-col items-center gap-5 text-center">
              <Avatar className="h-24 w-24 border border-primary/25 bg-card/80 shadow-[0_14px_40px_hsl(240_20%_2%_/_0.2)]">
                <AvatarImage src={form.avatarUrl || undefined} alt="Profile icon" />
                <AvatarFallback className="bg-primary/15 font-medium text-foreground">
                  {profileInitials}
                </AvatarFallback>
              </Avatar>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/jpg"
              className="hidden"
              onChange={handleAvatarSelect}
            />

            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-11 border-border/80 bg-background/70"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
              >
                {isUploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                {isUploadingAvatar ? "Uploading..." : "Upload icon"}
              </Button>

              {form.avatarUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11"
                  onClick={() => setForm((current) => ({ ...current, avatarUrl: "" }))}
                >
                  Clear icon
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm text-muted-foreground">LinkedIn</span>
                <Input
                  type="url"
                  value={form.linkedinUrl}
                  onChange={(event) => setForm((current) => ({ ...current, linkedinUrl: event.target.value }))}
                  placeholder="https://linkedin.com/in/your-handle"
                  className="h-11 border-border/80 bg-background/70"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm text-muted-foreground">GitHub</span>
                <Input
                  type="url"
                  value={form.githubUrl}
                  onChange={(event) => setForm((current) => ({ ...current, githubUrl: event.target.value }))}
                  placeholder="https://github.com/your-handle"
                  className="h-11 border-border/80 bg-background/70"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm text-muted-foreground">LeetCode</span>
                <Input
                  type="url"
                  value={form.leetcodeUrl}
                  onChange={(event) => setForm((current) => ({ ...current, leetcodeUrl: event.target.value }))}
                  placeholder="https://leetcode.com/u/your-handle"
                  className="h-11 border-border/80 bg-background/70"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm text-muted-foreground">Portfolio</span>
                <Input
                  type="url"
                  value={form.portfolioUrl}
                  onChange={(event) => setForm((current) => ({ ...current, portfolioUrl: event.target.value }))}
                  placeholder="https://your-portfolio.dev"
                  className="h-11 border-border/80 bg-background/70"
                />
              </label>
            </div>

            <label className="space-y-2">
              <span className="text-sm text-muted-foreground">Resume URL</span>
              <Input
                type="url"
                value={form.resumeUrl}
                onChange={(event) => setForm((current) => ({ ...current, resumeUrl: event.target.value }))}
                placeholder="https://drive.google.com/... or hosted resume URL"
                className="h-11 border-border/80 bg-background/70"
              />
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Button type="submit" className="h-11 w-full justify-center md:w-auto" disabled={isSaving}>
            <Save className="h-4 w-4" />
            {isSaving ? "Saving profile..." : "Save profile"}
          </Button>

          <div className="flex flex-wrap gap-2">
            {links.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.label}
                  href={item.value}
                  target="_blank"
                  rel="noreferrer"
                  className="coach-chip inline-flex items-center gap-2 hover:border-primary/30 hover:text-foreground"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </a>
              );
            })}
          </div>
        </div>
      </form>
    </motion.section>
  );
}
