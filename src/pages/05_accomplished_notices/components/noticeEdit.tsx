import * as React from "react";
import { PencilLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type AccomplishedNoticeRecord,
  type CategoryCounts,
  type DailyNoticeEntry,
  type NoticeCategory,
  NOTICE_CATEGORIES,
  aggregateDailyEntries,
} from "@/data/05_accomplished_notices";

const CATEGORY_LABEL: Record<NoticeCategory, string> = {
  NOD: "NOD",
  NTC: "NTC",
  NTCV: "NTCV",
  Abatement: "Abatement",
  Closure: "Closure",
};

function emptyBreakdown(): Record<NoticeCategory, CategoryCounts> {
  return NOTICE_CATEGORIES.reduce(
    (acc, category) => ({ ...acc, [category]: { pending: 0, accomplished: 0 } }),
    {} as Record<NoticeCategory, CategoryCounts>,
  );
}

interface NoticeEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: AccomplishedNoticeRecord | null;
  onSaved: (record: AccomplishedNoticeRecord) => void;
}

export function NoticeEditModal({ open, onOpenChange, record, onSaved }: NoticeEditModalProps) {
  const [days, setDays] = React.useState<DailyNoticeEntry[]>([]);

  React.useEffect(() => {
    if (!record || !open) return;
    const totalDays = new Date(record.reportYear, record.reportMonth, 0).getDate();
    const nextEntries = Array.from({ length: totalDays }, (_, index) => {
      const day = index + 1;
      const existing = record.dailyEntries.find((entry) => entry.day === day);
      return {
        day,
        remarks: existing?.remarks ?? "",
        breakdown: existing?.breakdown ?? emptyBreakdown(),
      } satisfies DailyNoticeEntry;
    });
    setDays(nextEntries);
  }, [record, open]);

  if (!record) return null;

  const updateField = (
    day: number,
    category: NoticeCategory,
    field: keyof CategoryCounts,
    value: string,
  ) => {
    const parsed = Number(value) || 0;
    setDays((prev) =>
      prev.map((entry) =>
        entry.day === day
          ? {
              ...entry,
              breakdown: {
                ...entry.breakdown,
                [category]: {
                  ...entry.breakdown[category],
                  [field]: parsed,
                },
              },
            }
          : entry,
      ),
    );
  };

  const updateRemarks = (day: number, value: string) => {
    setDays((prev) =>
      prev.map((entry) => (entry.day === day ? { ...entry, remarks: value } : entry)),
    );
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextRecord: AccomplishedNoticeRecord = {
      ...record,
      breakdown: aggregateDailyEntries(days, record.breakdown),
      dailyEntries: days,
    };
    onSaved(nextRecord);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PencilLine className="h-5 w-5 text-primary" /> Edit Notice Ledger
          </DialogTitle>
          <DialogDescription>
            Update entries from Day 1 through Day{" "}
            {new Date(record.reportYear, record.reportMonth, 0).getDate()} for {record.stationName}.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={submit}>
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
                {days.map((entry) => (
                  <tr key={entry.day} className="border-t border-border/60">
                    <td className="px-2 py-2 font-semibold">{entry.day}</td>
                    <td className="px-2 py-2">
                      <Input
                        value={entry.remarks}
                        onChange={(event) => updateRemarks(entry.day, event.target.value)}
                        className="min-w-[140px]"
                      />
                    </td>
                    {NOTICE_CATEGORIES.map((category) => (
                      <td key={`${entry.day}-${category}`} className="px-2 py-2">
                        <div className="grid gap-1">
                          <Label className="text-[10px]">P</Label>
                          <Input
                            type="number"
                            min={0}
                            value={entry.breakdown[category].pending}
                            onChange={(event) =>
                              updateField(entry.day, category, "pending", event.target.value)
                            }
                            className="h-8"
                          />
                          <Label className="text-[10px]">A</Label>
                          <Input
                            type="number"
                            min={0}
                            value={entry.breakdown[category].accomplished}
                            onChange={(event) =>
                              updateField(entry.day, category, "accomplished", event.target.value)
                            }
                            className="h-8"
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save month</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default NoticeEditModal;
