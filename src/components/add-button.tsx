import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AddButtonProps = React.ComponentProps<typeof Button> & {
  children: React.ReactNode;
};

const AddButton = React.forwardRef<HTMLButtonElement, AddButtonProps>(
  ({ className, children, ...props }, ref) => {
    // Uses the emerald/green family while ensuring white foreground for icon and text.
    // Consumers can still pass extra classes via `className` to tweak spacing/size.
    return (
      <Button
        ref={ref}
        className={cn(
          // Use the project's primary color token so the button matches the theme.
          // Force white text so icon + label are always readable on the primary background.
          // Also force SVG children to use white via child selectors so Lucide icons inherit the color.
          "gap-2 bg-primary text-white shadow hover:bg-primary/90 active:bg-primary/80 [&_svg]:text-white [&_svg]:!text-white [&>*]:text-white !text-white",
          className,
        )}
        {...props}
      >
        <span className="inline-flex items-center gap-2 text-white !text-white">{children}</span>
      </Button>
    );
  },
);

AddButton.displayName = "AddButton";

export default AddButton;
