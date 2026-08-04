import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Inline advisory shown under the reporting-period picker explaining that past
 * periods are read-only until a revision request is approved.
 */
export function PastDatesLockedNote({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 text-xs leading-relaxed text-muted-foreground",
        className,
      )}
    >
      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
      <span>
        Past dates are locked until a revision request is approved. Current and future dates
        remain editable.
      </span>
    </p>
  );
}

export default PastDatesLockedNote;
