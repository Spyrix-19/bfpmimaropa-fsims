import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(name?: string, size = 2, upper = true): string {
  const s = (name || "").trim();
  if (!s) return "";

  const words = s.split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    const raw = s.slice(0, size);
    return upper ? raw.toUpperCase() : raw;
  }

  const raw = words
    .slice(0, 4)
    .map((word) => word[0] ?? "")
    .join("");
  return upper ? raw.toUpperCase() : raw;
}

export function getAvatarSrc(entity: any): string | null {
  if (!entity) return null;

  const candidates = [
    entity.logourl,
    entity.logoUrl,
    entity.imageUrl,
    entity.avatarUrl,
    entity.profileurl,
  ];

  for (const value of candidates) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }

  return null;
}

// Date helpers now live in `@/lib/date-format`. Re-exported here for
// backwards compatibility with existing imports.
export {
  formatDate,
  formatLongDate,
  formatDateTime as formatDateTimeLong,
  toDateInput,
  isEmptyDate,
} from "@/lib/date-format";

/** Build a data URL from a filetype + base64 image payload, when both are present. */
export function imageDataToDataUrl(
  filetype?: string | null,
  imagedata?: string | null,
): string | null {
  if (!filetype || !imagedata) return null;
  const mime = filetype.includes("/") ? filetype : `image/${filetype.replace(/^\./, "")}`;
  return `data:${mime};base64,${imagedata}`;
}

/** Return the first record from a backend envelope response (or null). */
export function unwrapOne<T = any>(resp: { data?: unknown } | null | undefined): T | null {
  const env = (resp?.data ?? null) as { data?: unknown } | null;
  const inner = (env?.data ?? null) as unknown;
  if (Array.isArray(inner)) return (inner[0] ?? null) as T | null;
  return (inner ?? null) as T | null;
}

export function displayPersonName(name?: string | null, fallback?: string | null): string {
  const n = (name ?? "").trim();
  return n || (fallback ?? "—");
}

export function clampCoordinateInput(v: string): string {
  // Allow negative sign, digits, single decimal
  const cleaned = v.replace(/[^0-9.-]/g, "");
  const match = cleaned.match(/^-?\d*(\.\d*)?/);
  return match ? match[0] : "";
}

export function clampCoordinateNumber(v: any): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-180, Math.min(180, n));
}

export function buildYears(): number[] {
  const cur = new Date().getFullYear();
  const years: number[] = [];
  for (let y = cur - 2; y <= cur + 3; y++) years.push(y);
  return years;
}

export function toWhole(v: string): string {
  const d = v.replace(/[^\d]/g, "");
  if (d === "") return "";
  return String(parseInt(d, 10));
}

/** Convert an array of records into CSV. */
export function toCsv(rows: any[], headers?: string[]): string {
  if (!Array.isArray(rows) || rows.length === 0) return "";
  const keys =
    headers && headers.length
      ? headers
      : Array.from(new Set(rows.flatMap((r) => Object.keys(r || {}))));
  const escape = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [
    keys.join(","),
    ...rows.map((r) => keys.map((k) => escape((r as any)?.[k])).join(",")),
  ].join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Coerce any value to a finite number, defaulting to 0. */
export function toNumber(v: unknown): number {
  return Number(v ?? 0) || 0;
}

/**
 * Normalize a value for read-only numeric display: null, undefined, empty or
 * whitespace-only strings and non-numeric values render as 0.
 */
export function displayNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "string" && v.trim() === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
