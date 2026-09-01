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
import { FSIMS_SYSTEMNO, FSIMS_SYSTEMCODE, SUPER, ADMIN, PERSONNEL } from "@/lib/fsims-constants";



/** Modules a user may be authorized against. Drives sidebar + route guards. */
export type AppModule =
  | "dashboard"
  | "profile"
  | "inspections"
  | "monitoring"
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

interface StoredSession {
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
  restoreSession: () => void;
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
  const isPersonnel = resolvedRoleNo === 3;

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

  if (isPersonnel) {
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
  const t = Date.parse(expiration);
  if (Number.isNaN(t)) return true;
  return t <= Date.now();
}

function clearStoredSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("authToken");
  } catch {
    /* noop */
  }
}

function readStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession> | null;
    if (!parsed || !parsed.user || !parsed.expiration) return null;
    if (!parsed.user.accessToken || !parsed.user.systemaccess) return null;
    return parsed as StoredSession;
  } catch {
    return null;
  }
}

/**
 * Storage-only super admin check. Safe to call outside the AuthProvider tree
 * (e.g. from the top-level error boundary, which renders when React unmounts).
 */
export function isStoredSuperAdmin(): boolean {
  try {
    const stored = readStoredSession();
    return (stored?.user?.systemaccess?.rolecode || "").toUpperCase() === SUPER;
  } catch {
    return false;
  }
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
    try {
      if (s?.user.accessToken) localStorage.setItem("authToken", s.user.accessToken);
      else localStorage.removeItem("authToken");
    } catch {
      /* noop */
    }
  }, []);

  const logout = useCallback(() => {
    applySession(null);
    setPendingMember(null);
    clearStoredSession();
  }, [applySession]);

  const restoreSession = useCallback(() => {
    const stored = readStoredSession();
    if (!stored) {
      applySession(null);
      return;
    }
    if (isExpired(stored.expiration)) {
      clearStoredSession();
      applySession(null);
      return;
    }
    applySession({ user: stored.user, expiration: stored.expiration });
  }, [applySession]);

  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    setSession((prev) => {
      if (!prev) return prev;
      const nextUser = { ...prev.user, ...patch };
      const next: Session = { ...prev, user: nextUser };
      try {
        const store = localStorage.getItem(STORAGE_KEY) ? localStorage : sessionStorage;
        store.setItem(STORAGE_KEY, JSON.stringify({ user: nextUser, expiration: prev.expiration }));
        if (nextUser.accessToken) localStorage.setItem("authToken", nextUser.accessToken);
      } catch {
        /* noop */
      }
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
    restoreSession();
    setInitialized(true);
  }, [restoreSession]);

  useEffect(() => {
    if (expiryTimerRef.current) {
      window.clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
    if (!session) return;
    const ms = Date.parse(session.expiration) - Date.now();
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

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const resp = await authAPI.login(
            { badgeno: badgeno.trim(), userpass: password },
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
            const shouldRetry = transientFailure(resp.statusCode ?? 0, backendMessage);
            if (shouldRetry && attempt < 1) {
              await new Promise((resolve) => window.setTimeout(resolve, 800));
              continue;
            }
            return { ok: false, error: backendMessage || AUTH_MSG.INVALID_CREDENTIALS };
          }

          if (!data || typeof data !== "object") {
            return { ok: false, error: AUTH_MSG.SERVER };
          }

          if (!data.isSuccess || !data.member || !data.accessToken) {
            const shouldRetry = transientFailure(resp.statusCode ?? 0, backendMessage);
            if (shouldRetry && attempt < 1) {
              await new Promise((resolve) => window.setTimeout(resolve, 800));
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
          const stored: StoredSession = { user, expiration: data.expiration ?? "" };
          try {
            const store = remember ? localStorage : sessionStorage;
            store.setItem(STORAGE_KEY, JSON.stringify(stored));
            (remember ? sessionStorage : localStorage).removeItem(STORAGE_KEY);
          } catch {
            /* noop */
          }
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be within AuthProvider");
  return ctx;
}
