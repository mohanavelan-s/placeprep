import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

export default function ResumeSigilIcon({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-4 w-4", className)}
      aria-hidden="true"
      {...props}
    >
      <path d="M7.5 3.75h6.4l3.85 3.86V18.5a1.75 1.75 0 0 1-1.75 1.75h-8.5A1.75 1.75 0 0 1 5.75 18.5v-13A1.75 1.75 0 0 1 7.5 3.75Z" />
      <path d="M13.9 3.9V8h4.1" />
      <path d="M8.5 11h6.8" />
      <path d="M8.5 14h5.2" />
      <path d="m15.4 15.2.56 1.08 1.2.18-.87.85.2 1.19-1.09-.57-1.08.57.2-1.19-.88-.85 1.21-.18.55-1.08Z" />
    </svg>
  );
}
