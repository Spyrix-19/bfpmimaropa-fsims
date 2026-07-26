import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Neutral empty-state block for ledgers and popovers.
 * Keeps the "no results" copy consistent without altering existing layouts.
 */
export function EmptyState({
  message = "No results found.",
  children,
  className,
}: {
  message?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 py-8 text-center text-sm text-muted-foreground",
        className,
      )}
    >
      <div>{message}</div>
      {children}
    </div>
  );
}
