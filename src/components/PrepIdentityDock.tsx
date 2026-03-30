import { Code2, Github, Globe2, Linkedin } from "lucide-react";

import ResumeSigilIcon from "@/components/ResumeSigilIcon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface PrepIdentityLink {
  href: string;
  label: string;
  kind: "linkedin" | "github" | "leetcode" | "portfolio" | "resume";
}

interface PrepIdentityDockProps {
  links: PrepIdentityLink[];
}

const iconMap = {
  linkedin: Linkedin,
  github: Github,
  leetcode: Code2,
  portfolio: Globe2,
  resume: ResumeSigilIcon,
} as const;

const accentMap = {
  linkedin: "hover:border-sky-400/35 hover:bg-sky-400/10 hover:text-sky-100",
  github: "hover:border-foreground/20 hover:bg-foreground/5 hover:text-foreground",
  leetcode: "hover:border-amber-400/35 hover:bg-amber-400/10 hover:text-amber-100",
  portfolio: "hover:border-emerald-400/35 hover:bg-emerald-400/10 hover:text-emerald-100",
  resume: "hover:border-primary/40 hover:bg-primary/12 hover:text-foreground",
} as const;

export default function PrepIdentityDock({ links }: PrepIdentityDockProps) {
  if (!links.length) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-border/75 bg-card/55 px-2 py-1.5 shadow-[0_14px_45px_hsl(240_20%_2%_/_0.22)] backdrop-blur">
      {links.map((item) => {
        const Icon = iconMap[item.kind];

        return (
          <Tooltip key={item.kind}>
            <TooltipTrigger asChild>
              <a
                href={item.href}
                target="_blank"
                rel="noreferrer"
                aria-label={item.label}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background/75 text-muted-foreground transition-all duration-300 ${accentMap[item.kind]}`}
              >
                <Icon className={item.kind === "resume" ? "h-[17px] w-[17px]" : "h-4 w-4"} />
              </a>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="border-border/80 bg-card/95 text-foreground">
              {item.label}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
