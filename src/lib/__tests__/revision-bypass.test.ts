import { describe, expect, it } from "vitest";
import { deriveRevisionLock } from "@/pages/06_target-reference/revision/useRevisionRequests";
import type { FSISEditRequestModel } from "@/types/revisionrequestType";

const req = (over: Partial<FSISEditRequestModel>): FSISEditRequestModel =>
  ({
    requestno: "r1",
    referencekey: "",
    statusno: 0,
    statuscode: "",
    statusname: "",
    reportyear: 2026,
    reportmonth: 9,
    ...over,
  }) as FSISEditRequestModel;

describe("approved revision bypasses the lock", () => {
  it("locked day without approval stays locked", () => {
    const l = deriveRevisionLock({ requests: [], dateKey: "2026-09-15", isPast: true });
    expect(l.fieldsLocked).toBe(true);
    expect(l.needsRevisionRequest).toBe(true);
  });

  it("approved by status number 153 unlocks (any date format)", () => {
    const l = deriveRevisionLock({
      requests: [req({ statusno: 153, dateinspected: "9/15/2026 12:00:00 AM" })],
      dateKey: "2026-09-15",
      isPast: true,
    });
    expect(l.fieldsLocked).toBe(false);
  });

  it("approved by status name unlocks", () => {
    const l = deriveRevisionLock({
      requests: [req({ statusname: "Approved", dateinspected: "2026-09-15T00:00:00" })],
      dateKey: "2026-09-15",
      isPast: true,
    });
    expect(l.fieldsLocked).toBe(false);
  });

  it("approval for another day does not unlock", () => {
    const l = deriveRevisionLock({
      requests: [req({ statusno: 153, dateinspected: "2026-09-14" })],
      dateKey: "2026-09-15",
      isPast: true,
    });
    expect(l.fieldsLocked).toBe(true);
  });

  it("month-based approval unlocks the month even if the request carries a date", () => {
    const l = deriveRevisionLock({
      requests: [req({ statuscode: "APPROVED", dateinspected: "2026-09-03", reportmonth: 0 })],
      dateKey: "2026-09-01",
      report: { year: 2026, month: 9 },
      isPast: true,
    });
    expect(l.fieldsLocked).toBe(false);
  });
});

describe("editablestatus rules", () => {
  it("153 is editable even when read-only and past", () => {
    const l = deriveRevisionLock({ requests: [], isPast: true, editablestatus: 153, readOnly: true });
    expect(l.fieldsLocked).toBe(false);
  });
  it("152 is pending and locked even for a current date", () => {
    const l = deriveRevisionLock({ requests: [], isPast: false, editablestatus: 152 });
    expect(l.hasPendingRevision).toBe(true);
    expect(l.fieldsLocked).toBe(true);
  });
  it.each([154, 155, 156])("%i ignores isrevisionrequest and follows the date lock", (s) => {
    const past = deriveRevisionLock({ requests: [], isPast: true, editablestatus: s, isrevisionrequest: true });
    expect(past.hasPendingRevision).toBe(false);
    expect(past.fieldsLocked).toBe(true);
    const cur = deriveRevisionLock({ requests: [], isPast: false, editablestatus: s, isrevisionrequest: true });
    expect(cur.fieldsLocked).toBe(false);
  });
});
