/**
 * Central date-formatting helpers. Any year <= 1900 is treated as an empty
 * sentinel value (databases frequently emit 1899-12-30 or 1900-01-01 for
 * "no date"). Empty / invalid / sentinel values all render as the provided
 * placeholder (default: empty string).
 */

export const EMPTY_DATE_VALUE = "1900-01-01T00:00:00";
export const PHILIPPINE_TIMEZONE = "Asia/Manila";

const isSentinel = (d: Date) => d.getFullYear() <= 1900;

function parse(v?: string | Date | null): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return null;
  if (isSentinel(d)) return null;
  return d;
}

function getManilaDateParts(date: Date): Record<string, string> {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: PHILIPPINE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  return {
    year: map.year ?? String(date.getFullYear()),
    month: map.month ?? String(date.getMonth() + 1).padStart(2, "0"),
    day: map.day ?? String(date.getDate()).padStart(2, "0"),
    hour: map.hour ?? "00",
    minute: map.minute ?? "00",
    second: map.second ?? "00",
  };
}

export function serializePhilippineDateTime(value?: Date | string | null): string {
  if (value == null || value === "") return EMPTY_DATE_VALUE;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return EMPTY_DATE_VALUE;
  if (date.getFullYear() <= 1900) return EMPTY_DATE_VALUE;
  const { year, month, day, hour, minute, second } = getManilaDateParts(date);
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

export function formatDate(v?: string | Date | null, placeholder = ""): string {
  const d = parse(v);
  if (!d) return placeholder;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function formatLongDate(v?: string | Date | null, placeholder = ""): string {
  const d = parse(v);
  if (!d) return placeholder;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function formatDateTime(v?: string | Date | null, placeholder = ""): string {
  const d = parse(v);
  if (!d) return placeholder;
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function toDateInput(v?: string | Date | null): string {
  const d = parse(v);
  if (!d) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function isEmptyDate(v?: string | Date | null): boolean {
  return parse(v) === null;
}
