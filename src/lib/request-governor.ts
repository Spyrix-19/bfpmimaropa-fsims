/**
 * Client-side request governor.
 *
 * Real rate limiting must be enforced by the API. This module is the client
 * half: it smooths outbound traffic so the app never becomes the reason a
 * limiter trips, without changing any behaviour a user depends on.
 *
 * Design rules:
 * - Nothing is ever dropped. Requests are QUEUED, so every call that used to
 *   succeed still succeeds — it may just start a few milliseconds later.
 * - A global cap on concurrent in-flight requests.
 * - A per-endpoint minimum spacing between request starts.
 * - A cooperative pause: when the API answers 429, every caller waits out the
 *   advertised `Retry-After` instead of hammering.
 */

/** Max requests in flight at once across the whole app. */
const MAX_CONCURRENT = 8;
/** Minimum gap between two starts of the SAME endpoint. */
const MIN_ENDPOINT_INTERVAL_MS = 120;
/** Hard ceiling on a cooperative pause, so a bad header can't freeze the app. */
const MAX_PAUSE_MS = 60_000;

type Waiter = () => void;

let active = 0;
const queue: Waiter[] = [];
const lastStartByBucket = new Map<string, number>();
let pausedUntil = 0;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Endpoint identity for spacing: path only, query/params ignored. */
export const governorBucket = (method: string, url: string): string => {
  const path = (url.split("?")[0] || url).replace(/\/+$/, "");
  return `${method.toUpperCase()} ${path}`;
};

const pump = () => {
  while (active < MAX_CONCURRENT && queue.length > 0) {
    const next = queue.shift();
    if (!next) break;
    active += 1;
    next();
  }
};

const acquireSlot = (): Promise<void> =>
  new Promise<void>((resolve) => {
    if (active < MAX_CONCURRENT) {
      active += 1;
      resolve();
      return;
    }
    queue.push(resolve);
  });

const releaseSlot = () => {
  active = Math.max(0, active - 1);
  pump();
};

/**
 * Parse a `Retry-After` header (delta-seconds or HTTP-date) into milliseconds.
 * Returns null when absent or unparseable.
 */
export const parseRetryAfterMs = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, MAX_PAUSE_MS);
  }

  const at = Date.parse(raw);
  if (!Number.isNaN(at)) {
    return Math.min(Math.max(at - Date.now(), 0), MAX_PAUSE_MS);
  }

  return null;
};

/**
 * Called when the API reports 429. Every subsequent request waits until the
 * window has passed. Safe to call repeatedly; the longest pause wins.
 */
export const notifyRateLimited = (retryAfterMs: number | null) => {
  const wait = Math.min(retryAfterMs ?? 1000, MAX_PAUSE_MS);
  pausedUntil = Math.max(pausedUntil, Date.now() + wait);
};

/** Remaining cooperative pause in ms (0 when not paused). */
export const rateLimitPauseMs = (): number => Math.max(0, pausedUntil - Date.now());

/**
 * Run `fn` under the governor: waits for a free slot, respects per-endpoint
 * spacing and any active rate-limit pause, then releases the slot.
 */
export const withGovernor = async <T>(bucket: string, fn: () => Promise<T>): Promise<T> => {
  await acquireSlot();
  try {
    const pause = rateLimitPauseMs();
    if (pause > 0) await sleep(pause);

    const last = lastStartByBucket.get(bucket) ?? 0;
    const gap = Date.now() - last;
    if (gap < MIN_ENDPOINT_INTERVAL_MS) await sleep(MIN_ENDPOINT_INTERVAL_MS - gap);
    lastStartByBucket.set(bucket, Date.now());

    // Keep the spacing map from growing without bound on long sessions.
    if (lastStartByBucket.size > 500) {
      const cutoff = Date.now() - 60_000;
      for (const [key, at] of Array.from(lastStartByBucket.entries())) {
        if (at < cutoff) lastStartByBucket.delete(key);
      }
    }

    return await fn();
  } finally {
    releaseSlot();
  }
};

/** Test/diagnostic hook. */
export const governorStats = () => ({ active, queued: queue.length, pausedMs: rateLimitPauseMs() });
