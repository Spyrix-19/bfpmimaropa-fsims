export const BADGE_NUMBER_PATTERN = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)?$/;

export function sanitizeBadge(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9-]/g, "");
  const [prefix = "", ...restParts] = cleaned.split("-");
  const suffix = restParts.join("").replace(/-/g, "");
  return `${prefix}${suffix ? `-${suffix}` : ""}`.replace(/^-+|-+$/g, "");
}

export function isValidBadgeNumber(value: string): boolean {
  const badge = value.trim();
  return !!badge && BADGE_NUMBER_PATTERN.test(badge);
}
