import React from "react";
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
import { toast } from "@/lib/toast";
import { CalendarClock } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onRequestConfirm: (expiryDate: string) => void;
};

export default function ChangeExpiryDialog({ open, onOpenChange, onRequestConfirm }: Props) {
  const [expiryDate, setExpiryDate] = React.useState("");

  React.useEffect(() => {
    if (!open) setExpiryDate("");
  }, [open]);

  const handleContinue = () => {
    if (!expiryDate) {
      toast.error("Please select an expiry date");
      return;
    }
    onOpenChange(false);
    onRequestConfirm(expiryDate);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-full max-w-md min-h-0 flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <CalendarClock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Change Password Expiry</DialogTitle>
              <DialogDescription>Select the date your password should expire.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden px-5 py-4">
          <div className="mt-2 space-y-2">
            <Label>Expiry date</Label>
            <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
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
