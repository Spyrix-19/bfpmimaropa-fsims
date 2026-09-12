import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  AuthApiResponse,
  AuthMemberModel,
  AuthUser,
  FsimsAccess,
  SystemAccessEntry,
} from "@/types/authType";
import { authAPI } from "@/services/authAPI";
import { personnelAPI } from "@/services/personnelAPI";
import { unwrap } from "@/lib/api-envelope";
import { getClientIp } from "@/lib/client-ip";
import { FSIMS_SYSTEMNO, FSIMS_SYSTEMCODE, SUPER, ADMIN, PERSONNEL } from "@/lib/fsims-constants";
import { encryptPayload, decryptPayload, destroySessionKey } from "@/lib/secure-session";
import { setAccessToken, setCachedRoleCode, getCachedRoleCode } from "@/lib/auth-token";
import { setPastDateLockContext } from "@/lib/past-date-lock";

/** Modules a user may be authorized against. Drives sidebar + route guards. */
export type AppModule =
  | "dashboard"
  | "profile"
  | "inspections"
  | "monitoring"
  | "collection"
  | "reports"
  | "settings"
  | "users"
  | "logistics"
  | "target-revisions";

// All authenticated roles share page-level access to the common modules. The
// `users` module is admin-only and gated below in `canAccess`.
const ALLOWED_MODULES: ReadonlySet<AppModule> = new Set<AppModule>([
  "dashboard",
  "profile",
  "inspections",
  "monitoring",
  "collection",
  "reports",
  "settings",
  "logistics",
]);

/** Admin-only modules: only SUPER (1) and ADMIN (2) may access. */
const ADMIN_MODULES: ReadonlySet<AppModule> = new Set<AppModule>(["users"]);

const ROUTE_MODULE: { prefix: string; module: AppModule }[] = [
  { prefix: "/profile", module: "profile" },
  { prefix: "/inspections", module: "inspections" },
  { prefix: "/monitoring", module: "monitoring" },
  { prefix: "/collection", module: "collection" },
  { prefix: "/reports", module: "reports" },
  { prefix: "/logistics", module: "logistics" },
  { prefix: "/settings", module: "settings" },
  { prefix: "/users", module: "users" },
  { prefix: "/target-revision-requests", module: "target-revisions" },
  { prefix: "/monitoring-revision-requests", module: "target-revisions" },
  { prefix: "/revision-requests", module: "target-revisions" },
];

export function moduleForPath(pathname: string): AppModule {
  if (pathname === "/" || pathname === "") return "dashboard";
  const hit = ROUTE_MODULE.find(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`),
  );
  return hit?.module ?? "dashboard";
}

interface Session {
  user: AuthUser;
  expiration: string;
}

interface AuthCtx {
  user: AuthUser | null;
  accessToken: string | null;
  /** Resolved FSIMS entry — the only source of role truth. */
  systemAccess: FsimsAccess | null;
  isAuthenticated: boolean;
  initialized: boolean;
  isnewaccount: boolean;
  pendingMember: AuthMemberModel | null;
  login: (
    badgeno: string,
    password: string,
    remember: boolean,
  ) => Promise<{ ok: boolean; error?: string; requiresPasswordChange?: boolean }>;
  logout: () => void;
  restoreSession: () => Promise<void>;
  isPersonnel: () => boolean;
  isSuperAdmin: () => boolean;
  isAdministrator: () => boolean;
  hasRoleCode: (...codes: string[]) => boolean;
  canAccess: (module: AppModule) => boolean;
  /** True when the resolved FSIMS role number matches. 1=SUPER, 2=ADMIN, 3=PERSONNEL. */
  hasRole: (roleno: number) => boolean;
  /** Patch the in-memory + persisted session user (e.g. avatar, fullname). */
  updateUser: (patch: Partial<AuthUser>) => void;
  /** Re-fetch the member details and sync avatar/name into the session. */
  refreshUser: () => Promise<void>;
  clearPendingMember: () => void;
}

const AuthContext = createContext<AuthCtx | null>(null);
const STORAGE_KEY = "fsims_session";
const LEGACY_STORAGE_KEYS = [
  "auth_session",
  "hris_session",
  "cdms_session",
  "erms_session",
  "gadems_session",
  "fsims_session",
  "gis_session",
  "gad_session",
];

function clearSessionStorageKeys(except?: { store: Storage; key: string }) {
  for (const key of LEGACY_STORAGE_KEYS) {
    try {
      if (!(except && except.store === localStorage && except.key === key)) {
        localStorage.removeItem(key);
      }
      if (!(except && except.store === sessionStorage && except.key === key)) {
        sessionStorage.removeItem(key);
      }
    } catch {
      /* noop */
    }
  }
}

export const AUTH_MSG = {
  INVALID_CREDENTIALS:
    "Invalid badge number or password. Please verify your credentials and try again.",
  NO_FSIMS_ACCESS:
    "Your account does not have access to the Fire Safety Inspection Monitoring System. Please contact your administrator.",
  ACCESS_DENIED:
    "Access denied. Your account does not have permission to access FSIMS. Please contact your administrator.",
  INACTIVE: "Your account is inactive. Please contact your administrator for assistance.",
  NETWORK: "Unable to reach the server. Please check your connection and try again.",
  SERVER: "Unable to complete login at this time. Please try again later.",
} as const;

/** Locate the FSIMS entry in member.systemaccess[] by systemno (primary) or systemcode. */
function findFsimsAccess(m: AuthMemberModel): SystemAccessEntry | undefined {
  const list = m.systemaccess ?? [];
  return (
    list.find((x) => (x.systemno || "").toLowerCase() === FSIMS_SYSTEMNO.toLowerCase()) ??
    list.find((x) => (x.systemcode || "").toUpperCase() === FSIMS_SYSTEMCODE)
  );
}

function toFsimsAccess(entry: SystemAccessEntry): FsimsAccess {
  return {
    systemcode: "FSIMS",
    systemname: entry.systemname,
    hasaccess: entry.hasaccess,
    roleno: entry.roleno,
    rolecode: entry.rolecode,
    rolename: entry.rolename,
  };
}

export interface LocationScope {
  roleno: number;
  stationtype: number;
  provinceno: string;
  provincename: string;
  stationno: string;
  stationname: string;
  provinceLocked: boolean;
  stationLocked: boolean;
}

export function resolveLocationScope(
  user: AuthUser | null | undefined,
  roleno: number | null | undefined,
): LocationScope {
  const resolvedRoleNo = Number(roleno ?? 0) || 0;
  const stationType = Number(user?.stationtype ?? 0) || 0;
  const provinceNo = user?.provinceno ?? "";
  const provinceName = user?.provincename ?? "";
  const stationNo = user?.stationno ?? "";
  const stationName = user?.stationname ?? "";

  const isAdmin = resolvedRoleNo === 1 || resolvedRoleNo === 2;

  if (isAdmin) {
    if (stationType === 25 || stationType === 26) {
      return {
        roleno: resolvedRoleNo,
        stationtype: stationType,
        provinceno: "",
        provinceLocked: false,
        provincename: "",
        stationno: "",
        stationname: "",
        stationLocked: false,
      };
    }

    if (stationType === 27) {
      return {
        roleno: resolvedRoleNo,
        stationtype: stationType,
        provinceno: provinceNo,
        provinceLocked: true,
        provincename: provinceName,
        stationno: "",
        stationname: "",
        stationLocked: false,
      };
    }

    if ([28, 29, 30, 31].includes(stationType)) {
      return {
        roleno: resolvedRoleNo,
        stationtype: stationType,
        provinceno: provinceNo,
        provinceLocked: true,
        provincename: provinceName,
        stationno: stationNo,
        stationname: stationName,
        stationLocked: true,
      };
    }

    // Admins whose station type isn't a known HQ/province/station value fall
    // through to the shared scope below.
  }

  // Personnel and unmatched roles share the same scope: lock to whatever
  // province/station the account carries.
  return {
    roleno: resolvedRoleNo,
    stationtype: stationType,
    provinceno: provinceNo,
    provinceLocked: !!provinceNo,
    provincename: provinceName,
    stationno: stationNo,
    stationname: stationName,
    stationLocked: !!stationNo,
  };
}

function toAuthUser(m: AuthMemberModel, accessToken: string, fsims: FsimsAccess): AuthUser {
  const fullname =
    m.fullname ||
    [m.firstname, m.miname ? `${m.miname}.` : "", m.lastname, m.suffix]
      .filter(Boolean)
      .join(" ")
      .trim();
  return {
    memberno: m.memberno,
    badgeno: m.badgeno,
    lastname: m.lastname,
    firstname: m.firstname,
    fullname,
    rankno: m.rankno,
    rankcode: m.rankcode,
    rankname: m.rankname,
    stationno: m.stationno,
    stationcode: m.stationcode,
    stationname: m.stationname,
    stationtype: Number(m.stationtype ?? 0),
    designation: m.designation,
    profileurl: m.profileurl,
    latitude: m.latitude,
    longitude: m.longitude,
    regionno: m.regionno ?? "",
    regioncode: m.regioncode ?? "",
    regionname: m.regionname ?? "",

    provinceno: m.provinceno ?? "",
    provincename: m.provincename ?? "",

    cityno: m.cityno ?? "",
    cityname: m.cityname ?? "",

    zipcode: m.zipcode ?? "",

    barangayno: m.barangayno ?? "",
    barangayname: m.barangayname ?? "",
    isnewaccount: !!m.isnewaccount,
    systemaccess: fsims,
    accessToken,
    name: fullname,
  };
}

function isExpired(expiration: string): boolean {
  if (!expiration || typeof expiration !== "string") return false;
  const t = Date.parse(expiration);
  if (Number.isNaN(t)) return false;
  return t <= Date.now();
}

function clearStoredSession() {
  try {
    clearSessionStorageKeys();
  } catch {
    /* noop */
  }
  void destroySessionKey();
}

/** True when the persisted session lives in localStorage ("remember me"). */
function prefersLocalStorage(): boolean {
  try {
    return LEGACY_STORAGE_KEYS.some((key) => localStorage.getItem(key) !== null);
  } catch {
    return true;
  }
}

/** Persist the session as ciphertext in the chosen store. */
async function writeStoredSession(stored: Session, remember: boolean) {
  try {
    // Encrypt FIRST, then write, then prune other keys. Clearing before the
    // async encryption completes leaves a window where a page reload finds no
    // stored session and logs the user out.
    const payload = await encryptPayload(stored);
    const store = remember ? localStorage : sessionStorage;
    store.setItem(STORAGE_KEY, payload);
    clearSessionStorageKeys({ store, key: STORAGE_KEY });
  } catch {
    /* noop */
  }
}

async function readStoredSession(): Promise<{ session: Session; legacy: boolean } | null> {
  try {
    const candidates = [
      ...LEGACY_STORAGE_KEYS.map((key) => ({ source: "local", key })),
      ...LEGACY_STORAGE_KEYS.map((key) => ({ source: "session", key })),
    ];

    for (const { source, key } of candidates) {
      const raw = source === "local" ? localStorage.getItem(key) : sessionStorage.getItem(key);
      if (!raw) continue;
      const decoded = await decryptPayload<Partial<Session>>(raw);
      const parsed = decoded?.value;
      if (!parsed || !parsed.user) continue;
      // Allow missing or empty expiration; treat as session without expiry.
      if (!parsed.expiration) parsed.expiration = "";
      if (!parsed.user.accessToken || !parsed.user.systemaccess) continue;
      return { session: parsed as Session, legacy: !!decoded?.legacy };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Role check that works outside the AuthProvider tree (e.g. from the top-level
 * error boundary, which renders when React unmounts). Reads the in-memory role
 * cache — never raw browser storage.
 */
export function isStoredSuperAdmin(): boolean {
  return (getCachedRoleCode() || "") === SUPER;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [pendingMember, setPendingMember] = useState<AuthMemberModel | null>(null);
  const [initialized, setInitialized] = useState(false);
  const expiryTimerRef = useRef<number | null>(null);
  const sessionRef = useRef<Session | null>(null);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);


  const applySession = useCallback((s: Session | null) => {
    setSession(s);
    setAccessToken(s?.user.accessToken ?? null);
    setCachedRoleCode(s?.user.systemaccess?.rolecode ?? null);
    setPastDateLockContext(
      s ? { provinceno: s.user.provinceno ?? "", roleno: s.user.systemaccess?.roleno ?? 0 } : null,
    );
  }, []);

  const logout = useCallback(() => {
    applySession(null);
    setPendingMember(null);
    clearStoredSession();
  }, [applySession]);

  const restoreSession = useCallback(async () => {
    // Some browsers may delay IndexedDB availability or crypto keys may not
    // be ready immediately after a hard reload. Retry a couple of times with
    // small backoff before giving up to avoid logging the user out spuriously.
    let stored = await readStoredSession();
    if (!stored) {
      // Retry up to 3 times, small delay between attempts.
      for (let i = 0; i < 3 && !stored; i += 1) {
        // short backoff
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 250 * (i + 1)));
        // eslint-disable-next-line no-await-in-loop
        stored = await readStoredSession();
      }
    }

    if (!stored) {
      applySession(null);
      return;
    }

    if (isExpired(stored.session.expiration)) {
      clearStoredSession();
      applySession(null);
      return;
    }

    applySession({ user: stored.session.user, expiration: stored.session.expiration });
    if (stored.legacy) {
      // Seamless upgrade: re-save an older plain-text session as ciphertext.
      await writeStoredSession(stored.session, prefersLocalStorage());
    }
  }, [applySession]);

  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    setSession((prev) => {
      if (!prev) return prev;
      const nextUser = { ...prev.user, ...patch };
      const next: Session = { ...prev, user: nextUser };
      setAccessToken(nextUser.accessToken ?? null);
      setCachedRoleCode(nextUser.systemaccess?.rolecode ?? null);
      setPastDateLockContext({
        provinceno: nextUser.provinceno ?? "",
        roleno: nextUser.systemaccess?.roleno ?? 0,
      });
      void writeStoredSession(
        { user: nextUser, expiration: prev.expiration },
        prefersLocalStorage(),
      );
      return next;
    });
  }, []);

  const refreshUser = useCallback(async () => {
    const cur = sessionRef.current;
    if (!cur?.user) return;
    try {
      const resp = await personnelAPI.getDetails(
        { memberno: String(cur.user.memberno) },
        { suppressGlobalLoading: true },
      );
      const { data } = unwrap<any[]>(resp);
      const m = Array.isArray(data) ? data[0] : null;
      if (m) {
        updateUser({
          profileurl: m.profileurl ?? cur.user.profileurl,
          fullname: m.fullname ?? cur.user.fullname,
          name: m.fullname ?? cur.user.name,
        });
      }
    } catch {
      /* noop */
    }
  }, [updateUser]);

  useEffect(() => {
    let cancelled = false;
    void restoreSession().finally(() => {
      if (!cancelled) setInitialized(true);
    });
    return () => {
      cancelled = true;
    };
  }, [restoreSession]);

  useEffect(() => {
    if (expiryTimerRef.current) {
      window.clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
    if (!session) return;
    const expiryTime = Date.parse(session.expiration);
    if (Number.isNaN(expiryTime)) {
      // If the expiration is malformed or missing, do not auto-logout here.
      return;
    }
    const ms = expiryTime - Date.now();
    if (ms <= 0) {
      logout();
      return;
    }
    expiryTimerRef.current = window.setTimeout(() => logout(), ms);
    const onFocus = () => {
      if (isExpired(session.expiration)) logout();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      if (expiryTimerRef.current) window.clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [session, logout]);

  const login = useCallback<AuthCtx["login"]>(
    async (badgeno, password, remember) => {
      const transientFailure = (statusCode: number, message: string) => {
        const normalized = message.toLowerCase();
        return (
          statusCode === 0 ||
          statusCode === 408 ||
          statusCode === 500 ||
          statusCode === 502 ||
          statusCode === 503 ||
          statusCode === 504 ||
          normalized.includes("network") ||
          normalized.includes("connect") ||
          normalized.includes("timeout") ||
          normalized.includes("try again")
        );
      };

      const maybeRetry = async (shouldRetry: boolean, attempt: number): Promise<boolean> => {
        if (shouldRetry && attempt < 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 800));
          return true;
        }
        return false;
      };

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const clientIp = await getClientIp();
          const resp = await authAPI.login(
            { badgeno: badgeno.trim(), userpass: password, ipaddress: clientIp },
            { suppressGlobalLoading: true, suppressErrorToast: true },
          );
          const data = (resp?.data ?? null) as Partial<AuthApiResponse> | null;
          const backendMessage =
            typeof resp?.errorMessages === "string" && resp.errorMessages.trim()
              ? resp.errorMessages.trim()
              : typeof data?.errorMessages === "string" && data.errorMessages.trim()
                ? data.errorMessages.trim()
                : "";

          if (!resp?.isSuccess) {
            if (await maybeRetry(transientFailure(resp.statusCode ?? 0, backendMessage), attempt)) {
              continue;
            }
            return { ok: false, error: backendMessage || AUTH_MSG.INVALID_CREDENTIALS };
          }

          if (!data || typeof data !== "object") {
            return { ok: false, error: AUTH_MSG.SERVER };
          }

          if (!data.isSuccess || !data.member || !data.accessToken) {
            if (await maybeRetry(transientFailure(resp.statusCode ?? 0, backendMessage), attempt)) {
              continue;
            }
            return { ok: false, error: backendMessage || AUTH_MSG.INVALID_CREDENTIALS };
          }

          const member = data.member;

          if (member.isactive === false) {
            return { ok: false, error: AUTH_MSG.INACTIVE };
          }

          const fsimsEntry = findFsimsAccess(member);
          if (!fsimsEntry) return { ok: false, error: AUTH_MSG.NO_FSIMS_ACCESS };
          if (!fsimsEntry.hasaccess) return { ok: false, error: AUTH_MSG.ACCESS_DENIED };

          if (member.isnewaccount) {
            setPendingMember(member);
            return { ok: true, requiresPasswordChange: true };
          }

          const fsims = toFsimsAccess(fsimsEntry);
          const user = toAuthUser(member, data.accessToken ?? "", fsims);
          const stored: Session = { user, expiration: data.expiration ?? "" };
          await writeStoredSession(stored, remember);
          applySession({ user, expiration: data.expiration ?? "" });
          return { ok: true };
        } catch (e: unknown) {
          const err = e as {
            response?: { status?: number; data?: { errorMessages?: string } };
            code?: string;
          };
          const status = err?.response?.status;
          const upstream =
            typeof err?.response?.data?.errorMessages === "string"
              ? err.response.data.errorMessages.trim()
              : "";
          const isTransportFailure =
            status === 0 ||
            !err?.response ||
            ["ERR_NETWORK", "ECONNABORTED", "ETIMEDOUT", "ECONNRESET"].includes(err?.code ?? "");

          if (isTransportFailure && attempt < 1) {
            await new Promise((resolve) => window.setTimeout(resolve, 800));
            continue;
          }

          if (status === 401 || status === 400) {
            return { ok: false, error: upstream || AUTH_MSG.INVALID_CREDENTIALS };
          }
          if (isTransportFailure) {
            return { ok: false, error: AUTH_MSG.NETWORK };
          }
          return { ok: false, error: upstream || AUTH_MSG.SERVER };
        }
      }

      return { ok: false, error: AUTH_MSG.NETWORK };
    },
    [applySession],
  );

  const value = useMemo<AuthCtx>(() => {
    const sa = session?.user.systemaccess ?? null;
    const roleCode = (sa?.rolecode || "").toUpperCase();
    const isSuperAdmin = () => roleCode === SUPER;
    const isAdministrator = () => roleCode === ADMIN;
    const isPersonnel = () => roleCode === PERSONNEL;
    const hasRoleCode = (...codes: string[]) =>
      !!sa && codes.some((c) => (c || "").toUpperCase() === roleCode);
    const canAccess = (module: AppModule) => {
      if (!session?.user) return false;
      if (module === "target-revisions") {
        // Restricted to Super/Admin at MIMAROPA HQ (25) or NCR HQ (26).
        const rn = sa?.roleno ?? 0;
        const st = Number(session.user.stationtype ?? 0);
        return (rn === 1 || rn === 2) && (st === 25 || st === 26);
      }
      if (ADMIN_MODULES.has(module)) {
        const rn = sa?.roleno ?? 0;
        return rn === 1 || rn === 2;
      }
      return ALLOWED_MODULES.has(module);
    };
    const hasRole = (roleno: number) => (sa?.roleno ?? 0) === roleno;

    return {
      user: session?.user ?? null,
      accessToken: session?.user.accessToken ?? null,
      systemAccess: sa,
      isAuthenticated: !!session?.user,
      initialized,
      isnewaccount: session?.user.isnewaccount ?? false,
      pendingMember,
      clearPendingMember: () => setPendingMember(null),
      login,
      logout,
      restoreSession,
      isPersonnel,
      isSuperAdmin,
      isAdministrator,
      hasRoleCode,
      canAccess,
      hasRole,
      updateUser,
      refreshUser,
    };
  }, [session, pendingMember, initialized, login, logout, restoreSession, updateUser, refreshUser]);

  return (
    <AuthContext.Provider value={value}>
      {initialized ? children : <div aria-hidden className="min-h-screen bg-background" />}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be within AuthProvider");
  return ctx;
}
