/**
 * Central date-formatting helpers. Any year <= 1900 is treated as an empty
 * sentinel value (databases frequently emit 1899-12-30 or 1900-01-01 for
 * "no date"). Empty / invalid / sentinel values all render as the provided
 * placeholder (default: empty string).
 */

const isSentinel = (d: Date) => d.getFullYear() <= 1900;

function parse(v?: string | Date | null): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return null;
  if (isSentinel(d)) return null;
  return d;
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
