import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  PasswordChecklist,
  firstPasswordError,
  isPasswordValid,
} from "@/components/password-rules";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onRequestConfirm: (password: string) => void;
};

export default function ChangePasswordDialog({ open, onOpenChange, onRequestConfirm }: Props) {
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const reset = () => {
    setNewPwd("");
    setConfirmPwd("");
    setShowNewPwd(false);
    setShowConfirmPwd(false);
  };

  const handleContinue = () => {
    const err = firstPasswordError(newPwd);
    if (err) return toast.error(err);
    if (newPwd !== confirmPwd) return toast.error("Passwords do not match");
    onOpenChange(false);
    onRequestConfirm(newPwd);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="flex max-h-[92vh] w-full max-w-[440px] min-h-0 flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <KeyRound className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">Change Password</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                Enter a new password and confirm it before continuing.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block text-base font-medium">New password</Label>
              <div className="relative">
                <Input
                  type={showNewPwd ? "text" : "password"}
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPwd((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showNewPwd ? "Hide password" : "Show password"}
                >
                  {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label className="mb-2 block text-base font-medium">Confirm password</Label>
              <div className="relative">
                <Input
                  type={showConfirmPwd ? "text" : "password"}
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  autoComplete="new-password"
                  aria-invalid={confirmPwd.length > 0 && confirmPwd !== newPwd}
                  className={
                    confirmPwd.length === 0
                      ? "pr-10"
                      : confirmPwd === newPwd
                        ? "border-success/60 focus-visible:ring-success/30 pr-10"
                        : "border-destructive/70 focus-visible:ring-destructive/30 pr-10"
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPwd((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showConfirmPwd ? "Hide password" : "Show password"}
                >
                  {showConfirmPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPwd.length > 0 && confirmPwd !== newPwd && (
                <span className="mt-1.5 block text-[11px] font-medium text-destructive">
                  Passwords do not match.
                </span>
              )}
            </div>

            <PasswordChecklist password={newPwd} confirmPassword={confirmPwd} />
          </div>
        </div>

        <DialogFooter className="border-t bg-muted/30 px-5 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleContinue} disabled={!isPasswordValid(newPwd) || newPwd !== confirmPwd}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
