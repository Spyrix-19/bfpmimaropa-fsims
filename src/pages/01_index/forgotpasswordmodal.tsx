import React, { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend?: (value: string) => Promise<void> | void;
};

/**
 * Forgot Password entry point. The reset workflow is intentionally on hold —
 * submitting always surfaces an "unavailable" notice pointing users at the
 * System Administrator. Kept as a dialog so the future implementation can
 * drop in without touching the LoginModal.
 */
export default function ForgotPasswordModal({ open, onOpenChange, onSend }: Props) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      setValue("");
      setSending(false);
    }
  }, [open]);

  const handleSend = async () => {
    if (!value.trim()) {
      toast.error("Please provide your badge number or email.");
      return;
    }
    try {
      setSending(true);
      await onSend?.(value);
      onOpenChange(false);
      setNoticeOpen(true);
    } catch (e: any) {
      toast.error(e?.message || "Failed to send request.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-[440px] min-h-0 flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
          <DialogHeader className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Reset your password</h3>
                <p className="mt-1 text-sm text-muted-foreground">Enter your badge number or email address and we'll route your request to the system administrator.</p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden px-5 py-4">
            <div>
              <Label className="mb-2">Badge number or email</Label>
              <Input ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. 10001 or you@fsims.gov" />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSend} disabled={sending}>{sending ? "Sending…" : "Send"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={noticeOpen}
        onOpenChange={setNoticeOpen}
        ContentIcon={AlertTriangle}
        contentIconBgClass="tone-danger-soft"
        contentIconColorClass="text-destructive"
        title="Password reset temporarily unavailable"
        description="Password reset is currently on hold. Please contact your system administrator for assistance. This feature will be available soon."
        confirmLabel="OK"
        cancelClassName="hidden"
        onConfirm={() => setNoticeOpen(false)}
      />
    </>
  );
}
