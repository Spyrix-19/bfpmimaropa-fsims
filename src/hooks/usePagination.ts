import * as React from "react";

interface Options {
  initialPage?: number;
  initialPageSize?: number;
}

/**
 * Shared pagination state used by every list/grid page.
 * Encapsulates the identical `useState(1)` + `useState(N)` pattern that
 * previously lived in Monitoring, Target Reference, and Users Ledger.
 *
 * Behaviour is identical to inline `useState` — no debouncing, no reset
 * side-effects — so adopting this hook doesn't change any API call.
 */
export function usePagination({ initialPage = 1, initialPageSize = 12 }: Options = {}) {
  const [page, setPage] = React.useState(initialPage);
  const [pageSize, setPageSize] = React.useState(initialPageSize);
  const reset = React.useCallback(() => {
    setPage(initialPage);
    setPageSize(initialPageSize);
  }, [initialPage, initialPageSize]);
  return { page, setPage, pageSize, setPageSize, reset };
}
