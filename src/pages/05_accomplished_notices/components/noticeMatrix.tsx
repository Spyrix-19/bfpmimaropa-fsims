import * as React from "react";
import { LayoutGrid } from "lucide-react";

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

interface NoticeMatrixModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: AccomplishedNoticeRecord | null;
}

export function NoticeMatrixModal({ open, onOpenChange, record }: NoticeMatrixModalProps) {
  if (!record) return null;

  const daysInMonth = new Date(record.reportYear, record.reportMonth, 0).getDate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-primary" /> Notice Matrix
          </DialogTitle>
          <DialogDescription>
            Station matrix view for {record.stationName} · {record.reportMonth}/{record.reportYear}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto rounded-lg border border-border/70">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/60 text-left">
              <tr>
                <th className="px-2 py-2">Category</th>
                {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => (
                  <th key={day} className="px-2 py-2 text-center">
                    Day {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NOTICE_CATEGORIES.map((category) => (
                <tr key={category} className="border-t border-border/60">
                  <td className="px-2 py-2 font-semibold">{CATEGORY_LABEL[category]}</td>
                  {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => {
                    const entry = record.dailyEntries.find((item) => item.day === day);
                    const counts = entry?.breakdown[category] ?? { pending: 0, accomplished: 0 };
                    return (
                      <td key={`${category}-${day}`} className="px-2 py-2 text-center">
                        <div className="text-[11px] text-muted-foreground">P {counts.pending}</div>
                        <div className="text-[11px] font-semibold">A {counts.accomplished}</div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default NoticeMatrixModal;
