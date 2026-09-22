import * as React from "react";
import { UploadCloud, Loader2, Trash2, ImageIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import { toast } from "@/lib/toast";
import { unwrap } from "@/lib/api-envelope";
import { useAuth } from "@/lib/auth";
import { compressImage } from "@/lib/image-compress";
import { personnelAPI } from "@/services/personnelAPI";
import type { MemberModel, UploadMemberProfileDTO } from "@/types/personnelType";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: MemberModel | null;
  onSaved: () => void;
};

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png"];
const MAX_SIZE = 5 * 1024 * 1024;

/**
 * Profile photo upload / removal for a personnel record.
 *
 * Business rules preserved from the previous implementation:
 * - JPEG / JPG / PNG only, 5 MB maximum.
 * - Images are downscaled client-side before upload.
 * - Uploading your own photo refreshes the authenticated user so the
 *   sidebar avatar updates without a page reload.
 */
export default function UploadProfileModal({ open, onOpenChange, record, onSaved }: Props) {
  const { user, refreshUser } = useAuth();

  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string>("");
  const [progress, setProgress] = React.useState(0);
  const [uploading, setUploading] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const busy = uploading || removing;

  React.useEffect(() => {
    if (open) return;
    setFile(null);
    setProgress(0);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });
  }, [open]);

  const choose = (picked: File | null) => {
    if (!picked) return;
    if (!ALLOWED_TYPES.includes(picked.type)) {
      toast.error("Only JPEG, JPG or PNG images are allowed.");
      return;
    }
    if (picked.size > MAX_SIZE) {
      toast.error("Image must be 5 MB or smaller.");
      return;
    }
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(picked);
    });
    setFile(picked);
    setProgress(0);
  };

  const submit = async () => {
    if (!record || !file || !user) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file, { maxDimension: 1024, quality: 0.85 });
      const payload: UploadMemberProfileDTO = {
        memberno: record.memberno,
        badgeno: record.badgeno ?? "",
        file: compressed,
        updatedby: user.memberno,
      };
      const resp = await personnelAPI.uploadProfile(payload, {
        suppressGlobalLoading: true,
        timeout: 120000,
        progressCallback: (p) => setProgress(p),
      });
      const { ok, error } = unwrap(resp);
      if (!ok) {
        toast.error(error || "Unable to upload the profile photo.");
        return;
      }
      setProgress(100);
      toast.success("Profile photo uploaded.");
      if (String(user.memberno) === String(record.memberno)) await refreshUser();
      onOpenChange(false);
      onSaved();
    } finally {
      setUploading(false);
    }
  };

  const remove = async () => {
    if (!record || !user) return;
    setRemoving(true);
    try {
      const resp = await personnelAPI.deleteProfilePhoto(
        {
          memberno: record.memberno,
          badgeno: record.badgeno ?? "",
          deletedby: user.memberno,
        },
        { suppressGlobalLoading: true, suppressErrorToast: true },
      );
      const { ok, error } = unwrap(resp);
      if (!ok) {
        toast.error(error || "Unable to remove the profile photo.");
        return;
      }
      toast.success("Profile photo removed.");
      if (String(user.memberno) === String(record.memberno)) await refreshUser();
      onSaved();
    } catch {
      toast.error("Unable to remove the profile photo.");
    } finally {
      setRemoving(false);
      setRemoveConfirmOpen(false);
      onOpenChange(false);
    }
  };

  const name = record?.fullname || "";

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
        <DialogContent className="flex w-full max-w-[min(100vw-1rem,520px)] flex-col gap-0 overflow-hidden p-0 sm:rounded-lg">
          <DialogHeader className="shrink-0 border-b border-border bg-muted/40 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UploadCloud className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold tracking-tight sm:text-lg">
                  Upload Profile Photo
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  {name ? `Update the profile photo of ${name}.` : "Update the profile photo."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 p-5">
            <Card className="rounded-lg border border-border bg-card p-4 shadow-none">
              <div className="flex items-center gap-4">
                <AvatarWithFallback
                  entity={record}
                  src={previewUrl || record?.profileurl || undefined}
                  name={name}
                  className="h-16 w-16 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground">{name || ""}</div>
                  <div className="text-xs text-muted-foreground">
                    {file ? file.name : "JPEG, JPG or PNG · 5 MB maximum"}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  className="hidden"
                  onChange={(e) => choose(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => inputRef.current?.click()}
                  className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    {file ? "Choose a different image" : "Choose an image"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Images are downscaled automatically before upload.
                  </span>
                </button>
              </div>

              {uploading ? (
                <div className="mt-4">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Uploading… {Math.round(progress)}%
                  </p>
                </div>
              ) : null}
            </Card>
          </div>

          <DialogFooter className="shrink-0 flex-col gap-2 border-t border-border bg-muted/30 px-5 py-4 sm:flex-row sm:justify-between">
            <Button
              variant="outline"
              onClick={() => setRemoveConfirmOpen(true)}
              disabled={busy || !record}
              className="w-full gap-2 border-destructive/40 text-destructive hover:border-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"
            >
              {removing ? (
                <Loader2 className="h-4 w-4 animate-spin text-destructive" />
              ) : (
                <Trash2 className="h-4 w-4 text-destructive" />
              )}
              <span className="text-destructive hover:text-destructive">Remove photo</span>
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={busy}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button onClick={submit} disabled={busy || !file} className="w-full gap-2 sm:w-auto">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Upload
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removeConfirmOpen}
        onOpenChange={setRemoveConfirmOpen}
        title="Remove profile photo"
        description="Are you sure you want to remove this profile photo? This action can be reversed by uploading a new image."
        confirmLabel="Remove"
        confirmVariant="destructive"
        onConfirm={() => {
          setRemoveConfirmOpen(false);
          void remove();
        }}
      />
    </>
  );
}
