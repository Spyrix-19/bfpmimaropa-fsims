/**
 * Shared UI-layer constants for search popovers and paginated lists.
 * Kept separate from `fsims-constants.ts` (domain data) so presentational
 * tuning does not require touching business definitions.
 */

/** Page size used by every gentable / location / station / office search popover. */
export const SEARCH_POPOVER_PAGE_SIZE = 10;

/** Debounce delay (ms) for search inputs inside popovers and filter bars. */
export const SEARCH_DEBOUNCE_MS = 300;
