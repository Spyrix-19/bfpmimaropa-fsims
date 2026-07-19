import React from "react";
import { MoreVertical } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

type Variant = "square" | "circle";

type OptionButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  disabled?: boolean;
  tooltip?: string;
};

const OptionButton = React.forwardRef<HTMLButtonElement, OptionButtonProps>(
  ({ variant = "square", disabled = false, className = "", tooltip, ...rest }, ref) => {
    // add `group` so children (icon) can react to hover via `group-hover` classes
    const baseSquare =
      "group rounded-md p-2 bg-transparent text-primary transition-colors hover:bg-primary hover:text-white cursor-pointer";
    const baseCircle =
      "group inline-flex items-center justify-center h-8 w-8 rounded-full bg-transparent shadow-sm text-primary hover:bg-primary hover:text-white transition-colors cursor-pointer";

    const disabledClass =
      "opacity-50 cursor-not-allowed hover:!bg-transparent hover:!text-primary";

    const classes = `${variant === "circle" ? baseCircle : baseSquare} ${
      disabled ? disabledClass : ""
    } ${className}`.trim();

    const button = (
      <button
        ref={ref}
        type={(rest as any).type ?? "button"}
        className={classes}
        {...(rest as any)}
      >
        {/* ensure icon color responds to parent hover using group-hover */}
        <MoreVertical className="h-4 w-3 text-current transition-colors group-hover:text-white" />
      </button>
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
  },
);

OptionButton.displayName = "OptionButton";

export default OptionButton;
