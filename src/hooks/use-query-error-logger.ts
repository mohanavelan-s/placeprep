import { useEffect } from "react";

export function useQueryErrorLogger(label: string, error: unknown) {
  useEffect(() => {
    if (error) {
      console.error(`[${label}] Query failed.`, error);
    }
  }, [error, label]);
}
