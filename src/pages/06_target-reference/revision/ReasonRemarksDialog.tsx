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

/**
 * Shared dialog for actions that require Reason + Remarks:
 * user cancellation, admin cancellation, admin denial.
 */
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  reasonLabel?: string;
  remarksLabel?: string;
  confirmLabel: string;
  confirmVariant?: "default" | "destructive";
  onConfirm: (payload: { reason: string; remarks: string }) => void | Promise<void>;
}

export default function ReasonRemarksDialog({
  open,
  onOpenChange,
  title,
  description,
  reasonLabel = "Reason",
  remarksLabel = "Remarks",
  confirmLabel,
  confirmVariant = "default",
  onConfirm,
}: Props) {
  const [reason, setReason] = React.useState("");
  const [remarks, setRemarks] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setReason("");
      setRemarks("");
      setBusy(false);
    }
  }, [open]);

  const canConfirm = !busy && reason.trim().length > 0 && remarks.trim().length > 0;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setBusy(true);
    try {
      await onConfirm({ reason: reason.trim(), remarks: remarks.trim() });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3">
          <DialogTitle className="text-base font-bold">{title}</DialogTitle>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </DialogHeader>
        <div className="grid gap-3 px-5 py-4">
          <div>
            <Label className="text-xs font-semibold">
              {reasonLabel} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={500}
            />
          </div>
          <div>
            <Label className="text-xs font-semibold">
              {remarksLabel} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>
        </div>
        <DialogFooter className="border-t bg-muted/30 px-5 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant={confirmVariant} onClick={handleConfirm} disabled={!canConfirm}>
            {busy ? "Submitting…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
