import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Keeps a page's title row, notes and filter controls pinned directly below
 * the app header while the content underneath scrolls.
 *
 * The negative horizontal margins let the sticky band's background span the
 * full width of the main content padding so scrolled rows never show through.
 */
export const StickyPageTop = forwardRef<
  HTMLDivElement,
  { children: ReactNode; className?: string }
>(function StickyPageTop({ children, className }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "sticky z-50 -mx-4 -mt-4 space-y-3 border-b border-border/60 bg-background px-4 pb-3 pt-4 sm:-mx-6 sm:-mt-6 sm:px-6 sm:pb-4 sm:pt-6",
        className,
      )}
      style={{ top: "var(--app-header-h, 3.5rem)" }}
    >
      {children}
    </div>
  );
});

export default StickyPageTop;
