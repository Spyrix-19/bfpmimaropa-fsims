/**
 * Resolves a usable total-page count for the small paginated popovers
 * (station / province / personnel / gentable pickers).
 *
 * The backend envelope normally provides `totalPages` / `recordsTotal`, but a
 * few endpoints omit them. In that case we fall back to a best-effort estimate
 * based on the number of rows returned for the current page.
 */
export function resolvePageCount(args: {
  total?: number;
  totalPages?: number;
  pageSize: number;
  page: number;
  rowCount: number;
}): number {
  const { total = 0, totalPages = 0, pageSize, page, rowCount } = args;
  if (totalPages > 0) return totalPages;
  if (total > 0 && pageSize > 0) return Math.max(1, Math.ceil(total / pageSize));
  // Unknown total: a full page implies at least one more page exists.
  return Math.max(1, rowCount === pageSize ? page + 1 : page);
}
