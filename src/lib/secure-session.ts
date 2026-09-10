/**
 * Encrypted session storage.
 *
 * The session payload is encrypted with AES-GCM using the browser's built-in
 * Web Crypto API. The key is generated per device, marked non-extractable and
 * kept in IndexedDB — so browser storage only ever holds ciphertext, and the
 * key never sits next to the data it protects.
 *
 * A determined attacker with full control of the browser can still coax the
 * browser into decrypting. Removing the session from JavaScript entirely
 * requires a server-issued httpOnly cookie (a backend change).
 */

const DB_NAME = "fsims_secure";
const STORE_NAME = "keys";
const KEY_ID = "session-key";
const ENVELOPE_PREFIX = "enc.v1:";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(key: string): Promise<unknown> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

function idbPut(key: string, value: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

function idbDelete(key: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

let keyPromise: Promise<CryptoKey> | null = null;

function cryptoAvailable(): boolean {
  return (
    typeof crypto !== "undefined" &&
    !!crypto.subtle &&
    typeof indexedDB !== "undefined" &&
    typeof TextEncoder !== "undefined"
  );
}

async function getKey(): Promise<CryptoKey> {
  if (keyPromise) return keyPromise;
  keyPromise = (async () => {
    const existing = await idbGet(KEY_ID);
    if (existing && typeof existing === "object" && "algorithm" in (existing as CryptoKey)) {
      return existing as CryptoKey;
    }
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
      "encrypt",
      "decrypt",
    ]);
    await idbPut(KEY_ID, key);
    return key;
  })();
  return keyPromise;
}

function toBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) out += String.fromCharCode(bytes[i]);
  return btoa(out);
}

function fromBase64(value: string): Uint8Array {
  const raw = atob(value);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Encrypt a JSON-serializable payload into an opaque string. */
export async function encryptPayload(payload: unknown): Promise<string> {
  if (!cryptoAvailable()) return JSON.stringify(payload);
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data as unknown as BufferSource),
  );
  return `${ENVELOPE_PREFIX}${toBase64(iv)}.${toBase64(cipher)}`;
}

/**
 * Decrypt a stored value. Plain-text values written by older builds are still
 * parsed so existing sessions survive the upgrade.
 */
export async function decryptPayload<T>(raw: string): Promise<{ value: T; legacy: boolean } | null> {
  if (!raw) return null;
  if (!raw.startsWith(ENVELOPE_PREFIX)) {
    try {
      return { value: JSON.parse(raw) as T, legacy: true };
    } catch {
      return null;
    }
  }
  if (!cryptoAvailable()) return null;
  try {
    const [ivPart, cipherPart] = raw.slice(ENVELOPE_PREFIX.length).split(".");
    if (!ivPart || !cipherPart) return null;
    const key = await getKey();
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(ivPart) as unknown as BufferSource },
      key,
      fromBase64(cipherPart) as unknown as BufferSource,
    );
    return { value: JSON.parse(new TextDecoder().decode(plain)) as T, legacy: false };
  } catch {
    return null;
  }
}

/** Drop the device encryption key (called on sign-out). */
export async function destroySessionKey(): Promise<void> {
  keyPromise = null;
  try {
    await idbDelete(KEY_ID);
  } catch {
    /* noop */
  }
}
