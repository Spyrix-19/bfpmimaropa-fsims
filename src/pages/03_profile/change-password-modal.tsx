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
    if (newPwd.length < 8) return toast.error("Password must be at least 8 characters");
    if (!/[A-Z]/.test(newPwd)) return toast.error("Password must include an uppercase letter");
    if (!/[0-9]/.test(newPwd)) return toast.error("Password must include a number");
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPwd))
      return toast.error("Password must include a special character");
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
      <DialogContent className="flex max-h-[92vh] w-full max-w-md min-h-0 flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
          <DialogHeader className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <KeyRound className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">Change Password</DialogTitle>
                <DialogDescription>
                  Enter a new password. Must be 8+ chars with uppercase, number, and special character.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden px-5 py-4">
            <div className="mt-2 space-y-3">
          <div>
            <Label>New password</Label>
            <div className="relative">
              <Input
                type={showNewPwd ? "text" : "password"}
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowNewPwd((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-label={showNewPwd ? "Hide password" : "Show password"}
              >
                {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label>Confirm password</Label>
            <div className="relative">
              <Input
                type={showConfirmPwd ? "text" : "password"}
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPwd((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-label={showConfirmPwd ? "Hide password" : "Show password"}
              >
                {showConfirmPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          </div>
        </div>

        <DialogFooter className="border-t bg-muted/30 px-5 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleContinue}>Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
