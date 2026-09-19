/**
 * Typed readers for loosely-shaped API payloads.
 *
 * Some endpoints return the same logical field under different casings
 * (`provinceno`, `provinceNo`, `Provinceno`). Instead of casting those rows to
 * `any`, treat them as `Record<string, unknown>` and read each field through
 * these helpers, which narrow the value to a concrete primitive type.
 */

/** Narrows an unknown value to a plain object of unknown values. */
export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Narrows an unknown value to an array of unknown items. */
export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Returns the first key that holds a non-empty string/number value, as a
 * string. Falls back to `fallback` when no candidate key carries a value.
 */
export function readString(
  source: Record<string, unknown>,
  keys: readonly string[],
  fallback = "",
): string {
  for (const key of keys) {
    const raw = source[key];
    if (typeof raw === "string" && raw.trim() !== "") return raw;
    if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  }
  return fallback;
}

/** Returns the first key that holds a finite number, else `fallback`. */
export function readNumber(
  source: Record<string, unknown>,
  keys: readonly string[],
  fallback = 0,
): number {
  for (const key of keys) {
    const raw = source[key];
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw))) {
      return Number(raw);
    }
  }
  return fallback;
}

/** Returns the first key that holds an array, else an empty array. */
export function readArray(source: Record<string, unknown>, keys: readonly string[]): unknown[] {
  for (const key of keys) {
    if (Array.isArray(source[key])) return source[key] as unknown[];
  }
  return [];
}

/** Returns the first key that holds a boolean/boolean-like value. */
export function readBoolean(
  source: Record<string, unknown>,
  keys: readonly string[],
  fallback = false,
): boolean {
  for (const key of keys) {
    const raw = source[key];
    if (typeof raw === "boolean") return raw;
    if (typeof raw === "number") return raw !== 0;
  }
  return fallback;
}
