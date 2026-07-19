import React from "react";
import { Pencil } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

type Variant = "square" | "circle";

interface EditButtonProps {
  variant?: Variant;
  disabled?: boolean;
  onClick?: (e?: React.MouseEvent) => void;
  className?: string;
  ariaLabel?: string;
  tooltip?: string;
  icon?: React.ReactNode;
}

export default function EditButton({
  variant = "square",
  disabled = false,
  onClick,
  className = "",
  ariaLabel = "Edit",
  tooltip,
  icon,
}: EditButtonProps) {
  // Match the original inline button used in leave.tsx: square variant
  const baseSquare =
    "rounded-md p-2 bg-card text-primary border border-border transition-colors hover:bg-primary hover:text-white group-hover:bg-primary group-hover:text-white";

  const baseCircle =
    "inline-flex items-center justify-center h-8 w-8 rounded-full bg-card border border-border shadow-sm text-primary hover:bg-primary hover:text-white transition-colors cursor-pointer";

  // Disabled: visually muted (opacity) but still allow hover color change (white icon on hover)
  // Cursor should be the circular 'not-allowed' symbol while hover visual styles still apply.
  // We keep pointer-events enabled so the hover styles trigger, but short-circuit clicks in onClick.
  const disabledClass = "opacity-60 !cursor-not-allowed";

  const classes = `${variant === "circle" ? baseCircle : baseSquare} ${
    disabled ? disabledClass : ""
  } ${className}`.trim();

  // allow passing a custom icon; clone to ensure sizing and direct svg child when needed
  let renderedIcon: React.ReactNode = icon;
  if (React.isValidElement(icon)) {
    const prev = (icon as any).props?.className ?? "";
    const sizeClass = prev.includes("h-") ? prev : `h-4 w-4 ${prev}`.trim();
    renderedIcon = React.cloneElement(icon as React.ReactElement, { className: sizeClass } as any);
  }

  const button = (
    <span className="inline-block">
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={(e) => {
          if (disabled) return;
          onClick?.(e);
        }}
        className={classes}
      >
        {renderedIcon ?? <Pencil className="h-4 w-4" />}
      </button>
    </span>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}
