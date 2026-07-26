import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { MONTHS } from "@/lib/fsims-constants";
import { useAuth } from "@/lib/auth";
import { createRequest, getSettings } from "./mockStore";
import type { RevisionModule } from "./types";
import { revisionrequestAPI } from "@/services/revisionrequestAPI";
import { unwrap, EMPTY_GUID } from "@/lib/api-envelope";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  station: {
    stationno: string;
    stationcode: string;
    stationname: string;
    provinceno: string;
    provincename: string;
    cityname: string;
  };
  year: number;
  month: number;
  /** Source module. Defaults to "target-reference". */
  module?: RevisionModule;
  /** Target row referencekey (targetno) sent to the API. */
  referencekey?: string;
  onSubmitted?: () => void;
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 rounded-md border border-border/60 bg-muted/40 px-2.5 py-1.5 text-sm">
        {value || "—"}
      </div>
    </div>
  );
}

export default function RevisionRequestDialog({
  open,
  onOpenChange,
  station,
  year,
  month,
  module,
  referencekey,
  onSubmitted,
}: Props) {
  const { user } = useAuth();
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const settings = getSettings();

  React.useEffect(() => {
    if (!open) {
      setReason("");
      setSubmitting(false);
    }
  }, [open]);

  const requestedBy =
    user?.fullname || user?.name || user?.badgeno || "Current user";
  const monthName = MONTHS.find((m) => m.value === month)?.name ?? String(month);

  const canSubmit =
    !submitting && (!settings.requireReason || reason.trim().length > 0);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    // Call the real API first.
    const resp = await revisionrequestAPI.create({
      requestno: EMPTY_GUID,
      referencekey: referencekey || EMPTY_GUID,
      stationno: station.stationno,
      reportyear: year,
      reportmonth: month,
      requesttype: "TARGET",
      requestremarks: reason,
      statusno: 0,
      requestedby: user?.memberno ?? EMPTY_GUID,
    });
    const { ok, error } = unwrap(resp);
    if (!ok) {
      toast.error(error || "Unable to submit revision request.");
      setSubmitting(false);
      return;
    }

    // Mirror into the local store so status badges / cancel controls
    // remain reactive while the backend flag propagates.
    const res = createRequest({
      module,
      stationno: station.stationno,
      stationcode: station.stationcode,
      stationname: station.stationname,
      provinceno: station.provinceno,
      provincename: station.provincename,
      cityname: station.cityname,
      reportyear: year,
      reportmonth: month,
      requestedByUserId: user?.memberno ?? "unknown",
      requestedByName: requestedBy,
      reason,
      remarks: "",
    });
    if (!res.ok) {
      // API succeeded but local mirror rejected (e.g., duplicate). Non-fatal.
      console.warn("Local revision mirror failed:", res.error);
    }
    toast.success("Revision request submitted for review.");
    onSubmitted?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="max-w-md p-0 overflow-hidden"
      >
        <DialogHeader className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3">
          <DialogTitle className="text-base font-bold">Request Revision</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Requesting revision for <span className="font-semibold text-foreground">{monthName} {year}</span>. Submission does not unlock the record.
          </p>
        </DialogHeader>

        <div className="grid gap-3 px-5 py-4">
          <div>
            <Label className="text-xs font-semibold">
              Reason {settings.requireReason && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="Explain why this month needs to be revised."
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter className="border-t bg-muted/30 px-5 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "Submitting…" : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}