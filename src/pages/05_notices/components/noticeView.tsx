import * as React from "react";
import { Eye } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type AccomplishedNoticeRecord,
  type NoticeCategory,
  NOTICE_CATEGORIES,
} from "@/data/05_accomplished_notices";

const CATEGORY_LABEL: Record<NoticeCategory, string> = {
  NOD: "NOD",
  NTC: "NTC",
  NTCV: "NTCV",
  Abatement: "Abatement",
  Closure: "Closure",
};

interface NoticeViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: AccomplishedNoticeRecord | null;
}

export function NoticeViewModal({ open, onOpenChange, record }: NoticeViewModalProps) {
  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" /> View Notice Ledger
          </DialogTitle>
          <DialogDescription>
            Daily breakdown for {record.stationName} · {record.reportMonth}/{record.reportYear}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto rounded-lg border border-border/70">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/60 text-left">
              <tr>
                <th className="px-2 py-2">Day</th>
                <th className="px-2 py-2">Remarks</th>
                {NOTICE_CATEGORIES.map((category) => (
                  <th key={category} className="px-2 py-2 text-center">
                    {CATEGORY_LABEL[category]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {record.dailyEntries.map((entry) => (
                <tr key={entry.day} className="border-t border-border/60">
                  <td className="px-2 py-2 font-semibold">{entry.day}</td>
                  <td className="px-2 py-2 text-muted-foreground">{entry.remarks || "—"}</td>
                  {NOTICE_CATEGORIES.map((category) => (
                    <td key={`${entry.day}-${category}`} className="px-2 py-2 text-center">
                      <div className="text-xs text-muted-foreground">
                        P {entry.breakdown[category].pending}
                      </div>
                      <div className="text-xs font-semibold">
                        A {entry.breakdown[category].accomplished}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default NoticeViewModal;
