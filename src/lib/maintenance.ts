/**
 * Global maintenance-mode flag.
 *
 * VITE_BFP_MIMAROPA_MAINTENANCE="TRUE" (any casing) → whole application is gated
 * anything else / missing                            → normal application behaviour
 *
 * Always import this constant instead of reading the env var directly.
 */
export const IS_MAINTENANCE_MODE =
  String((import.meta.env?.VITE_BFP_MIMAROPA_MAINTENANCE as string | undefined) ?? "")
    .trim()
    .toUpperCase() === "TRUE";

export default IS_MAINTENANCE_MODE;
