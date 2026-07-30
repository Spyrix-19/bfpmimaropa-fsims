import { AlertTriangle } from "lucide-react";

interface CurrentMonthNoteProps {
  /** True when the user may Add / Edit / Delete records. */
  canManage: boolean;
  className?: string;
}

/**
 * Short, emphasized reminder that record actions are limited to the current
 * month. View-only users (Super Admin / Admin on station types 25, 26, 27)
 * get the view-only wording.
 */
export function CurrentMonthNote({ canManage, className = "" }: CurrentMonthNoteProps) {
  return (
    <div
      role="note"
      className={`flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive ${className}`}
    >
      <AlertTriangle className="mt-[1px] h-4 w-4 shrink-0" />
      <span>
        {canManage
          ? "Note: View, edit, and delete are allowed for the current month only."
          : "Note: View only — current month only."}
      </span>
    </div>
  );
}

export default CurrentMonthNote;
