import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Emphasized inline advisory shown under the reporting-period date explaining
 * that past periods are read-only until a revision request is approved.
 * Shared by the Compliance, Notice, and Target Reference entry dialogs so the
 * wording and treatment stay identical across the app.
 */
export function PastDatesLockedNote({ className }: { className?: string }) {
  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10",
        "px-3 py-2 text-xs font-semibold text-destructive",
        className,
      )}
    >
      <AlertTriangle className="mt-[1px] h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        Note: Past dates are locked until a revision request is approved. Current and future dates
        remain editable.
      </span>
    </div>
  );
}

export default PastDatesLockedNote;
