import React from "react";
import { Trash } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

type Variant = "square" | "circle";

interface DeleteButtonProps {
  variant?: Variant;
  disabled?: boolean;
  onClick?: (e?: React.MouseEvent) => void;
  className?: string;
  ariaLabel?: string;
  tooltip?: string;
  // optional custom icon (renders inside the button). If omitted, uses X icon.
  icon?: React.ReactNode;
}

export default function DeleteButton({
  variant = "square",
  disabled = false,
  onClick,
  className = "",
  ariaLabel = "Delete",
  tooltip,
  icon,
}: DeleteButtonProps) {
  const baseSquare =
    "rounded-md p-2 bg-card text-red-600 border border-border transition-colors hover:bg-red-600 hover:text-white group-hover:bg-red-600 group-hover:text-white";
  const baseCircle =
    "inline-flex items-center justify-center h-8 w-8 rounded-full bg-card border border-border shadow-sm text-red-600 hover:bg-red-600 hover:text-white transition-colors cursor-pointer";

  // Disabled: visually muted but still allow hover color change; force not-allowed cursor
  const disabledClass = "opacity-60 !cursor-not-allowed";

  const classes = `${variant === "circle" ? baseCircle : baseSquare} ${
    disabled ? disabledClass : ""
  } ${className}`.trim();

  // If caller passes a React element for icon, clone it so the SVG is a direct child of the button
  // (this allows the global CSS :has selectors to detect the svg and apply the destructive family).
  let renderedIcon: React.ReactNode = icon;
  if (React.isValidElement(icon)) {
    const prev = (icon as any).props?.className ?? "";
    const sizeClass = prev.includes("h-") ? prev : `h-4 w-4 ${prev}`.trim();
    const className = sizeClass; // caller may include 'lucide-trash' if they want destructive styling
    renderedIcon = React.cloneElement(icon as React.ReactElement, { className } as any);
  }

  const button = (
    <span className="inline-block rounded group">
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={(e) => {
          if (disabled) return;
          onClick?.(e);
        }}
        className={classes}
      >
        {renderedIcon ?? <Trash className="h-4 w-4 lucide-trash" />}
      </button>
    </span>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent className="bg-destructive text-destructive-foreground">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}
