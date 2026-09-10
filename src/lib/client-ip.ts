/**
 * Best-effort public IP of the current client.
 *
 * The backend requires an `ipaddress` on OTP requests. We resolve it once per
 * session from a public echo service and fall back to a neutral placeholder
 * when the lookup is blocked (offline, ad-blocker, corporate proxy).
 */

const FALLBACK_IP = "0.0.0.0";

let cached: string | null = null;
let inflight: Promise<string> | null = null;

export async function getClientIp(): Promise<string> {
  if (cached) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 4000);
      const res = await fetch("https://api.ipify.org?format=json", {
        signal: controller.signal,
      });
      window.clearTimeout(timer);
      const json = (await res.json()) as { ip?: string };
      cached = typeof json?.ip === "string" && json.ip.trim() ? json.ip.trim() : FALLBACK_IP;
    } catch {
      cached = FALLBACK_IP;
    } finally {
      inflight = null;
    }
    return cached ?? FALLBACK_IP;
  })();

  return inflight;
}
