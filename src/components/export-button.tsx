import * as React from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Download } from "lucide-react";
import { toCsv, downloadCsv } from "@/lib/utils";

export type ExportButtonProps = {
  rows: any[];
  filename?: string;
  headers?: string[];
  className?: string;
  label?: string;
};

export default function ExportButton({
  rows,
  filename,
  headers,
  className,
  label,
}: ExportButtonProps) {
  const isEmpty = !Array.isArray(rows) || rows.length === 0;

  const handle = React.useCallback(() => {
    if (isEmpty) return;
    try {
      let useHeaders = headers;
      if ((!useHeaders || useHeaders.length === 0) && Array.isArray(rows) && rows.length > 0) {
        // Ensure common contact fields appear in exports in a friendly order
        const defaultOrder = [
          "stationno",
          "stationcode",
          "stationname",
          "address",
          "emailaddress",
          "contact",
          "latitude",
          "longitude",
          "recordtypecode",
          "recordtypename",
          "statuscode",
          "required",
        ];
        const keys = new Set<string>();
        // collect keys from rows
        rows.forEach((r) => Object.keys(r || {}).forEach((k) => keys.add(k)));
        // build ordered list: defaults first if present, then remaining keys
        const ordered: string[] = [];
        defaultOrder.forEach((k) => {
          if (keys.has(k)) {
            ordered.push(k);
            keys.delete(k);
          }
        });
        Array.from(keys)
          .sort()
          .forEach((k) => ordered.push(k));
        useHeaders = ordered;
      }
      const csv = toCsv(rows, useHeaders);
      downloadCsv(filename || `export-${Date.now()}.csv`, csv);
    } catch (e) {
      // swallow — caller can show toast if desired
      console.error(e);
    }
  }, [rows, filename, headers, isEmpty]);

  const sharedClass = [
    // Force primary color for icon + text in all states (hover/active/focus)
    // Use important modifiers to override variant hover styles from Button.
    "!text-primary",
    // Force hover background so we have an exact class to reuse for the tooltip
    "!hover:!bg-primary",
    "!hover:!text-primary",
    "!active:!text-primary",
    "!focus:!text-primary",
    // Ensure SVG children inherit the text color so the icon follows the text.
    "[&_svg]:text-current",
    // When there are no rows, present a not-allowed cursor so the user
    // sees it isn't actionable, but keep the green styling.
    // Force the not-allowed cursor as important so it overrides the base
    // `cursor-pointer` from the Button variant.
    isEmpty ? "!cursor-not-allowed" : "cursor-pointer",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  // When the button is "empty" we still render it as active-looking but
  // non-interactive. Wrap in a Tooltip to show a themed message.
  if (isEmpty) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              onClick={handle}
              aria-disabled
              tabIndex={-1}
              className={sharedClass}
            >
              <Download className="h-4 w-4" />
              <span className="ml-2">{label ?? "Export"}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent className="!bg-primary !text-white rounded-md px-3 py-1.5 text-xs shadow-md border-transparent">
            No records to export
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Button variant="outline" onClick={handle} className={sharedClass}>
      <Download className="h-4 w-4" />
      <span className="ml-2">{label ?? "Export"}</span>
    </Button>
  );
}
