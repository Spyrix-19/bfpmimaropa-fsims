import * as React from "react";
import { Copy, ShieldAlert, Trash2, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

export interface SecureDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Line describing what will be deleted (e.g. "STATION A — March 2026"). */
  subject?: React.ReactNode;
  /** Extra context/warning text. */
  description?: React.ReactNode;
  title?: string;
  confirmLabel?: string;
  deleting?: boolean;
  onConfirm: () => void | Promise<void>;
}

/**
 * Secure Delete Confirmation
 *
 * Requires the current user to type "<BADGENO> <LASTNAME>" verbatim before
 * the destructive confirm button unlocks. Used by both Fire Safety
 * Compliance and Target Reference for consistent, high-friction deletions.
 */
export default function SecureDeleteDialog({
  open,
  onOpenChange,
  subject,
  description,
  title = "Confirm secure deletion",
  confirmLabel = "Delete",
  deleting = false,
  onConfirm,
}: SecureDeleteDialogProps) {
  const { user } = useAuth();
  const badgeno = (user?.badgeno ?? "").toString().trim();
  const lastname = (user?.lastname ?? "").toString().trim();
  const phrase = `${badgeno} ${lastname}`.trim();
  const missingIdentity = !badgeno || !lastname;

  const [input, setInput] = React.useState("");

  React.useEffect(() => {
    if (!open) setInput("");
  }, [open]);

  const matches = phrase.length > 0 && input.trim() === phrase;
  const canConfirm = matches && !deleting && !missingIdentity;

  const copyPhrase = async () => {
    if (!phrase) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(phrase);
      } else {
        const ta = document.createElement("textarea");
        ta.value = phrase;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast.success("Verification phrase copied.");
    } catch {
      toast.error("Unable to copy phrase — please type it manually.");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (deleting) return;
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full tone-danger-soft">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                This action cannot be undone. Type the verification phrase to confirm.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {subject ? (
            <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Deleting
              </div>
              <div className="mt-0.5 font-medium text-foreground">{subject}</div>
            </div>
          ) : null}

          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Your credentials
            </Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border bg-background px-3 py-2 text-sm">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Badge No.
                </div>
                <div className="mt-0.5 font-mono text-sm font-semibold">
                  {badgeno || <span className="text-muted-foreground">—</span>}
                </div>
              </div>
              <div className="rounded-md border bg-background px-3 py-2 text-sm">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Last Name
                </div>
                <div className="mt-0.5 font-mono text-sm font-semibold">
                  {lastname || <span className="text-muted-foreground">—</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Type this phrase to confirm
            </Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 select-all truncate rounded-md border bg-muted/60 px-3 py-2 font-mono text-sm">
                {phrase || "—"}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyPhrase}
                disabled={!phrase}
                className="gap-1.5"
                title="Copy verification phrase"
              >
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
            </div>
            <Input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type the phrase exactly"
              disabled={deleting || missingIdentity}
              className="font-mono"
              aria-invalid={input.length > 0 && !matches}
            />
            {missingIdentity ? (
              <p className="text-[11px] font-medium text-destructive">
                Your profile is missing Badge No. or Last Name — please update it before deleting.
              </p>
            ) : input.length > 0 && !matches ? (
              <p className="text-[11px] font-medium text-destructive">
                Phrase does not match.
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter className="mt-2 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canConfirm}
            onClick={() => void onConfirm()}
            className="gap-2"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {deleting ? "Deleting…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
