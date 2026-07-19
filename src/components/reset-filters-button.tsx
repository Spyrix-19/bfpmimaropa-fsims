import * as React from "react";
import { RotateCw } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  onReset: () => void;
  tooltip?: string;
};

/**
 * Icon-only reset button. On click, the icon plays a single 400ms 360° spin.
 * Rapid clicks don't stack: the animation restarts cleanly for each click.
 */
export default function ResetFiltersButton({
  onReset,
  tooltip = "Reset Filters",
  className,
  ...rest
}: Props) {
  const [spinKey, setSpinKey] = React.useState(0);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    setSpinKey((k) => k + 1);
    onReset();
    rest.onClick?.(e);
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            {...rest}
            onClick={handleClick}
            className={cn(
              "group h-10 w-10 inline-flex items-center justify-center rounded-md border bg-background text-primary transition-colors hover:bg-primary hover:text-white",
              className,
            )}
            aria-label={tooltip}
          >
            <RotateCw
              key={spinKey}
              className={cn(
                "h-4 w-4",
                spinKey > 0 && "[animation:spin_400ms_ease-out_1]",
              )}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
