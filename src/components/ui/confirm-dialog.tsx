import * as React from "react";
import { ShieldCheck, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  headerTitle?: string;
  HeaderIcon?: React.ComponentType<any>;
  ContentIcon?: React.ComponentType<any> | null;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  showCancel?: boolean;
  onConfirm: () => void | Promise<void>;
  // Customization
  confirmVariant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link"
    | "success";
  cancelVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  confirmClassName?: string;
  cancelClassName?: string;
  contentIconBgClass?: string;
  contentIconColorClass?: string;
  onCancel?: () => void;

  // Backwards-compatible props (old API)
  // keep optional so existing call sites still work
  // old: title:string, description?:string, ContentIcon?:React.ComponentType, contentIconBgClass?, contentIconColorClass?, confirmLabel?, cancelLabel?, confirmVariant?:"default"|"destructive"|"success", onConfirm
};

export default function ConfirmDialog({
  open,
  onOpenChange,
  headerTitle,
  HeaderIcon = ShieldCheck,
  ContentIcon = null,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  showCancel = true,
  onConfirm,
  confirmVariant = "default",
  cancelVariant = "outline",
  confirmClassName,
  cancelClassName,
  contentIconBgClass = "bg-red-50",
  contentIconColorClass = "text-red-600",
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" hideCloseButton={!!headerTitle}>
        <div className="flex flex-col items-stretch gap-4 p-4 md:p-5">
          {headerTitle ? (
            <>
              <div className="flex items-center gap-3 -mt-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
                  <HeaderIcon className="h-5 w-5" />
                </div>
                <div className="text-xl font-extrabold tracking-wide">{headerTitle}</div>
                <div className="ml-auto">
                  <DialogClose asChild>
                    <button
                      type="button"
                      aria-label="Close"
                      className="inline-flex items-center justify-center rounded-full p-1 text-muted-foreground hover:bg-muted/10"
                    >
                      <X className="h-4 w-4" />
                      <span className="sr-only">Close</span>
                    </button>
                  </DialogClose>
                </div>
              </div>

              <div className="border-t" />
            </>
          ) : null}

          <div className="grid grid-cols-[64px_1fr] items-start gap-4">
            {ContentIcon ? (
              <div className={"flex h-14 w-14 items-center justify-center rounded-full shadow-sm " + contentIconBgClass + " " + contentIconColorClass}>
                <ContentIcon className="h-7 w-7" />
              </div>
            ) : (
              <div />
            )}

            <div className="flex flex-col items-start text-left">
              <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
              {description ? (
                <DialogDescription className="text-sm text-muted-foreground mt-2 max-w-[28rem]">
                  {description}
                </DialogDescription>
              ) : null}
            </div>
          </div>

          <DialogFooter className="flex justify-end gap-3 mt-2">
            {showCancel ? (
              <DialogClose asChild>
                <Button
                  variant={cancelVariant as any}
                  size="default"
                  className={"px-4 " + (cancelClassName ?? "")}
                  onClick={() => onCancel?.()}
                >
                  {cancelLabel}
                </Button>
              </DialogClose>
            ) : null}
            <Button
              variant={confirmVariant as any}
              size="default"
              onClick={() => {
                onOpenChange(false);
                void onConfirm();
              }}
              className={"px-4 " + (confirmClassName ?? "")}
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { ConfirmDialog };
