export type IdempotencyHeaders = Record<string, string | number | boolean | null | undefined>;

export const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const isMutationMethod = (method: string): boolean =>
  MUTATION_METHODS.has(method.toUpperCase());

export const generateIdempotencyKey = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join("-");
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
};

export const withIdempotencyKey = <T extends IdempotencyHeaders>(
  method: string,
  headers?: T,
  existingKey?: string,
): { headers: T; idempotencyKey: string | null } => {
  const nextHeaders = { ...(headers ?? {}) } as IdempotencyHeaders;

  if (!isMutationMethod(method)) {
    return { headers: nextHeaders as T, idempotencyKey: null };
  }

  const idempotencyKey =
    existingKey ??
    (nextHeaders["Idempotency-Key"] as string | undefined) ??
    generateIdempotencyKey();
  nextHeaders["Idempotency-Key"] = idempotencyKey;

  return {
    headers: nextHeaders as T,
    idempotencyKey,
  };
};
