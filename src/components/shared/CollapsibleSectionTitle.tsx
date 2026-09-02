import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Compliance module section heading. Optionally acts as a keyboard-accessible
 * toggle button when `onToggle` is provided. Extracted from three identical
 * local `SectionTitle` copies (New / Edit / View) — same markup and classes.
 */
export function CollapsibleSectionTitle({
  title,
  subtitle,
  icon,
  expanded,
  onToggle,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const ToggleIcon = expanded ? ChevronUp : ChevronDown;
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3",
        onToggle && "cursor-pointer select-none",
      )}
      onClick={onToggle}
      role={onToggle ? "button" : undefined}
      aria-expanded={onToggle ? expanded : undefined}
      tabIndex={onToggle ? 0 : undefined}
      onKeyDown={
        onToggle
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggle();
              }
            }
          : undefined
      }
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
      </h2>
      <div className="flex items-center gap-2">
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        {onToggle && (
          <ToggleIcon className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
        )}
      </div>
    </div>
  );
}

export default CollapsibleSectionTitle;
