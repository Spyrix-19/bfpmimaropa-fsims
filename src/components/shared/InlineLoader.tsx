import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Standard inline spinner + label used across ledgers, popovers, and forms.
 * Replaces the repeated `<Loader2 className="h-4 w-4 animate-spin" /> Loading…` snippet.
 */
export function InlineLoader({
  label = "Loading…",
  className,
  iconClassName = "h-4 w-4",
}: {
  label?: string;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm text-muted-foreground", className)}>
      <Loader2 className={cn("animate-spin", iconClassName)} />
      {label}
    </span>
  );
}
