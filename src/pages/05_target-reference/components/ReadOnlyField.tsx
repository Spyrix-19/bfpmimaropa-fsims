import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Read-only display that matches the height, border, radius, padding, and
 * typography of `Select`/`LocationSearchSelect`/`StationSearchSelect`
 * triggers used in the Target Reference module — so a locked control drops
 * into the same slot without any layout shift and without the browser's
 * default `disabled` appearance.
 */
export default function ReadOnlyField({
  value,
  placeholder = "—",
  className,
  title,
}: {
  value?: string | number | null;
  placeholder?: string;
  className?: string;
  title?: string;
}) {
  const text =
    value === null || value === undefined || value === "" ? placeholder : String(value);
  const isPlaceholder = text === placeholder;
  return (
    <div
      title={title}
      aria-readonly="true"
      className={cn(
        "flex h-10 w-full min-w-0 items-center rounded-md border bg-muted/40 px-3 text-left text-sm",
        isPlaceholder ? "text-muted-foreground" : "text-foreground",
        className,
      )}
    >
      <span className="truncate">{text}</span>
    </div>
  );
}
