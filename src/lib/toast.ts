/**
 * App-wide toast wrapper.
 *
 * Why this exists: a single page can fire several API calls in parallel
 * (dashboard charts, matrix panels, dropdown lookups). When the network or
 * the API is briefly unreachable, EVERY one of those callers used to raise
 * its own "Unable to reach the server…" toast, stacking 3-6 identical
 * banners on screen.
 *
 * This wrapper re-exports sonner's `toast` but automatically assigns a shared
 * sonner id to transport-level messages, so they collapse into exactly one
 * toast no matter how many requests failed.
 */
import { toast as sonnerToast } from "sonner";

type ToastArgs = Parameters<typeof sonnerToast.error>;

const EMPTY_LEDGER_TOAST_PATTERNS = [
  /\bno\s+data\b/i,
  /\bno\s+records?\b/i,
  /\bno\s+result\b/i,
  /\bempty\s+result\b/i,
  /\bno\s+data\s+available\b/i,
  /\brecord(?:s)?\s+not\s+found\b/i,
];

function shouldSuppressToast(message: ToastArgs[0]): boolean {
  if (typeof message !== "string") return false;
  const trimmed = message.trim();
  if (!trimmed) return false;
  return EMPTY_LEDGER_TOAST_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Any error toast with identical text collapses into a single sonner toast,
 * regardless of how many callers raised it.
 */
function sharedIdFor(message: ToastArgs[0]): string | undefined {
  if (typeof message !== "string") return undefined;
  const trimmed = message.trim().toLowerCase();
  if (!trimmed) return undefined;
  return `err:${trimmed}`;
}

function withSharedId(message: ToastArgs[0], data: ToastArgs[1]): ToastArgs[1] {
  const id = sharedIdFor(message);
  if (!id || data?.id) return data;
  return { ...(data ?? {}), id };
}

const errorToast = (message: ToastArgs[0], data?: ToastArgs[1]) => {
  if (shouldSuppressToast(message)) return;
  return sonnerToast.error(message, withSharedId(message, data));
};

const baseToast = ((...args: Parameters<typeof sonnerToast>) => {
  const [message] = args;
  if (shouldSuppressToast(message as ToastArgs[0])) return;
  return sonnerToast(...args);
}) as typeof sonnerToast;

/**
 * Drop-in replacement for sonner's `toast`. Identical API — only
 * `toast.error` gains the dedupe behaviour described above.
 */
export const toast = Object.assign(baseToast, sonnerToast, { error: errorToast });
