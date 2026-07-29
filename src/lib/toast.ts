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
import { ApiMessages } from "@/lib/api-messages";

const SHARED_IDS: Array<{ message: string; id: string }> = [
  { message: ApiMessages.NETWORK, id: "api-network-error" },
  { message: ApiMessages.DB_CONNECTION, id: "api-db-error" },
  { message: ApiMessages.INVALID_SESSION, id: "api-session-error" },
  { message: ApiMessages.API_ERR, id: "api-generic-error" },
  { message: ApiMessages.UNKNOWN, id: "api-unknown-error" },
];

type ToastArgs = Parameters<typeof sonnerToast.error>;

function sharedIdFor(message: ToastArgs[0]): string | undefined {
  if (typeof message !== "string") return undefined;
  const trimmed = message.trim();
  return SHARED_IDS.find((entry) => entry.message === trimmed)?.id;
}

function withSharedId(message: ToastArgs[0], data: ToastArgs[1]): ToastArgs[1] {
  const id = sharedIdFor(message);
  if (!id || data?.id) return data;
  return { ...(data ?? {}), id };
}

const errorToast = (message: ToastArgs[0], data?: ToastArgs[1]) =>
  sonnerToast.error(message, withSharedId(message, data));

/**
 * Drop-in replacement for sonner's `toast`. Identical API — only
 * `toast.error` gains the dedupe behaviour described above.
 */
export const toast = Object.assign(
  ((...args: Parameters<typeof sonnerToast>) => sonnerToast(...args)) as typeof sonnerToast,
  sonnerToast,
  { error: errorToast },
);
