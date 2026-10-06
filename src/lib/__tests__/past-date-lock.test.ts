import { describe, it, expect, beforeEach } from "vitest";
import {
  getMonthlyLockCutoff,
  isPastMonth,
  setPastDateLockContext,
  getDateLockDecision,
} from "@/lib/past-date-lock";

// Manila wall time → instant (UTC+8)
const ph = (y: number, mo: number, d: number, h = 0, mi = 0) =>
  new Date(Date.UTC(y, mo - 1, d, h - 8, mi));

describe("monthly cutoff", () => {
  it("is 11:59 PM Manila on the 4th of next month", () => {
    expect(getMonthlyLockCutoff(2026, 9)!.getTime()).toBe(ph(2026, 10, 4, 23, 59).getTime());
    expect(getMonthlyLockCutoff(2026, 12)!.getTime()).toBe(ph(2027, 1, 4, 23, 59).getTime());
    expect(getMonthlyLockCutoff(2028, 2)!.getTime()).toBe(ph(2028, 3, 4, 23, 59).getTime());
  });
  it("exact boundary", () => {
    expect(isPastMonth(2026, 9, ph(2026, 10, 4, 23, 58))).toBe(false);
    expect(isPastMonth(2026, 9, ph(2026, 10, 4, 23, 59))).toBe(true);
    expect(isPastMonth(2026, 9, ph(2026, 10, 5))).toBe(true);
    expect(isPastMonth(2026, 12, ph(2027, 1, 4, 23, 58))).toBe(false);
    expect(isPastMonth(2026, 12, ph(2027, 1, 4, 23, 59))).toBe(true);
  });
  it("current and future months never past (Oct 6, 2026)", () => {
    const now = ph(2026, 10, 6, 10);
    expect(isPastMonth(2026, 10, now)).toBe(false);
    expect(isPastMonth(2026, 11, now)).toBe(false);
    expect(isPastMonth(2027, 1, now)).toBe(false);
    expect(isPastMonth(2026, 8, now)).toBe(true);
    expect(isPastMonth(2026, 1, now)).toBe(true);
  });
});

describe("decision precedence", () => {
  beforeEach(() => setPastDateLockContext(null));
  it("super admin bypasses everything", () => {
    setPastDateLockContext({ provinceno: "x", roleno: 1 });
    expect(getDateLockDecision("2020-01-01", "target-reference").reason).toBe("SUPER_ADMINISTRATOR");
  });
  it("no province → unlocked", () => {
    expect(getDateLockDecision("2020-01-01", "monitoring").locked).toBe(false);
  });
});
