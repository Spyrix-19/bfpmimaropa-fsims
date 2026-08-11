/**
 * Global feature flag for the past-date lock (and the Revision Request
 * requirement that it triggers).
 *
 * VITE_BFP_MIMAROPA_PAST_DATE_LOCK="TRUE"  → past-date lock enabled (default behaviour)
 * anything else / missing                  → past-date lock bypassed entirely
 *
 * Always import this constant instead of reading the env var directly.
 */
export const IS_PAST_DATE_LOCK_ENABLED =
  (import.meta.env?.VITE_BFP_MIMAROPA_PAST_DATE_LOCK as string | undefined) === "TRUE";

export default IS_PAST_DATE_LOCK_ENABLED;
