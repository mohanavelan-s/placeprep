import type { InputHTMLAttributes } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface HoursInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  wrapperClassName?: string;
}

export default function HoursInput({
  className,
  wrapperClassName,
  ...props
}: HoursInputProps) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <Input
        type="number"
        step="0.5"
        inputMode="decimal"
        className={cn("pr-14", className)}
        {...props}
      />
      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs uppercase tracking-[0.18em] text-muted-foreground">
        hrs
      </span>
    </div>
  );
}
