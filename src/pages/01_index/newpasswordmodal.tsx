import React, { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { AlertTriangle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { AuthMemberModel } from "@/types/authType";
import { authAPI } from "@/services/authAPI";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: AuthMemberModel | null;
  onUpdated?: () => void;
};

const validatePassword = (p: string) => {
  if (!p || p.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(p)) return "Password must include an uppercase letter.";
  if (!/[0-9]/.test(p)) return "Password must include a number.";
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(p)) return "Password must include a special character.";
  return null;
};

export default function SetNewPasswordModal({ open, onOpenChange, member, onUpdated }: Props) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const newRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => newRef.current?.focus(), 150);
    } else {
      setNewPassword("");
      setConfirmPassword("");
      setPending(false);
    }
  }, [open]);

  const handleUpdate = async () => {
    const err = validatePassword(newPassword);
    if (err) return toast.error(err);
    if (newPassword !== confirmPassword) return toast.error("Passwords do not match.");
    if (!member) return toast.error("Missing member context.");

    setPending(true);
    try {
      const resp = await authAPI.updatePassword(
        {
          memberno: member.memberno,
          userpass: newPassword,
          updatedby: member.memberno,
        },
        { suppressGlobalLoading: true },
      );
      const data: any = resp?.data ?? null;
      if (!data?.isSuccess) {
        toast.error(data?.errorMessages || "Failed to update password.");
        return;
      }
      onOpenChange(false);
      onUpdated?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.errorMessages || e?.message || "Failed to update password.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-[980px] min-h-0 flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Set your new password</h3>
              <p className="mt-1 text-sm text-muted-foreground">Your account requires a new password before you can access the system.</p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden px-5 py-4">
          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">New password</span>
              <div className="relative">
                <Input
                  ref={newRef}
                  type={showNew ? "text" : "password"}
                  name="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  aria-label={showNew ? "Hide password" : "Show password"}
                  onClick={() => setShowNew((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">At least 8 characters, one uppercase letter, one number, one special character.</p>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium">Confirm password</span>
              <div className="relative">
                <Input
                  name="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                  onClick={() => setShowConfirm((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => setOpenConfirm(true)} disabled={pending}>
              {pending ? "Saving…" : "Update password"}
            </Button>
          </div>

          <ConfirmDialog
            open={openConfirm}
            onOpenChange={setOpenConfirm}
            ContentIcon={AlertTriangle}
            contentIconBgClass="tone-danger-soft"
            contentIconColorClass="text-destructive"
            title="Confirm password change"
            description="Are you sure you want to set this new password? This will update your account immediately."
            confirmLabel="Confirm"
            cancelLabel="Cancel"
            confirmVariant="success"
            onConfirm={() => void handleUpdate()}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
