import * as React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
};

export default function PaginationControls({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: Props) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  // Always include the active page size so the select never shows a value
  // that differs from the rows actually being fetched.
  const pageSizeOptions = React.useMemo(() => {
    const base = [5, 10, 20, 50];
    if (!base.includes(pageSize)) base.push(pageSize);
    return base.sort((a, b) => a - b);
  }, [pageSize]);

  // If filters shrink the result set below the current page, snap back into range
  // so the list never renders as an empty page.
  React.useEffect(() => {
    if (total > 0 && page > pageCount) onPageChange(pageCount);
  }, [total, page, pageCount, onPageChange]);

  return (
    <>
      {/* Mobile */}
      <div className="mt-4 md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="h-8 rounded-md border bg-background px-2 text-sm"
              aria-label="Rows per page"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page === 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="text-sm px-3 py-1 bg-muted/20 rounded-md">
              {`Page ${page} of ${pageCount}`}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.min(pageCount, page + 1))}
              disabled={total <= page * pageSize}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-2 text-center text-sm text-muted-foreground">{`Showing ${start}-${end} of ${total}`}</div>
      </div>

      {/* Desktop */}
      <div className="hidden md:flex mt-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="h-8 rounded-md border bg-background px-2 text-sm"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span className="sr-only" aria-live="polite">{`Page ${page} of ${pageCount}`}</span>
        </div>

        <div className="text-sm text-muted-foreground">{`Showing ${start}-${end} of ${total}`}</div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="text-sm">{`Page ${page} of ${pageCount}`}</div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(pageCount, page + 1))}
            disabled={total <= page * pageSize}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}
