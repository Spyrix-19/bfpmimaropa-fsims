import * as React from "react";
import { CalendarPlus2 } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import {
  type AccomplishedNoticeRecord,
  type CategoryCounts,
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

interface NoticeAddModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: AccomplishedNoticeRecord | null;
  onSaved: (record: AccomplishedNoticeRecord) => void;
}

export function NoticeAddModal({ open, onOpenChange, record, onSaved }: NoticeAddModalProps) {
  const [day, setDay] = React.useState(1);
  const [remarks, setRemarks] = React.useState("");
  const [breakdown, setBreakdown] =
    React.useState<Record<NoticeCategory, CategoryCounts>>(emptyBreakdown());

  React.useEffect(() => {
    if (!record || !open) return;
    const totalDays = new Date(record.reportYear, record.reportMonth, 0).getDate();
    const existing = record.dailyEntries.find((entry) => entry.day === day);
    if (existing) {
      setRemarks(existing.remarks ?? "");
      setBreakdown(existing.breakdown);
    } else {
      setRemarks("");
      setBreakdown(emptyBreakdown());
    }
    if (day > totalDays) setDay(1);
  }, [record, open, day]);

  React.useEffect(() => {
    if (!record || !open) return;
    const totalDays = new Date(record.reportYear, record.reportMonth, 0).getDate();
    setDay((current) => (current > totalDays ? 1 : current));
  }, [record, open]);

  if (!record) return null;

  const updateField = (category: NoticeCategory, field: keyof CategoryCounts, value: string) => {
    const parsed = Number(value) || 0;
    setBreakdown((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: parsed,
      },
    }));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextEntries = [...record.dailyEntries.filter((entry) => entry.day !== day)];
    nextEntries.push({ day, remarks, breakdown });
    nextEntries.sort((a, b) => a.day - b.day);

    const nextRecord: AccomplishedNoticeRecord = {
      ...record,
      breakdown: aggregateDailyEntries(nextEntries, record.breakdown),
      dailyEntries: nextEntries,
    };

    onSaved(nextRecord);
    onOpenChange(false);
  };

  const totalDays = new Date(record.reportYear, record.reportMonth, 0).getDate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus2 className="h-5 w-5 text-primary" /> Add Notice Entry
          </DialogTitle>
          <DialogDescription>
            Add a single day entry for {record.stationName} in {record.reportMonth}/
            {record.reportYear}.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Day</Label>
              <Input
                type="number"
                min={1}
                max={totalDays}
                value={day}
                onChange={(event) => setDay(Number(event.target.value) || 1)}
              />
            </div>
            <div>
              <Label>Remarks</Label>
              <Input value={remarks} onChange={(event) => setRemarks(event.target.value)} />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border/70 p-3">
            <div className="text-sm font-semibold">Notice counts</div>
            <div className="grid gap-3 md:grid-cols-2">
              {NOTICE_CATEGORIES.map((category) => (
                <div key={category} className="rounded-md border border-border/60 p-3">
                  <div className="mb-2 text-sm font-semibold">{CATEGORY_LABEL[category]}</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Pending</Label>
                      <Input
                        type="number"
                        min={0}
                        value={breakdown[category].pending}
                        onChange={(event) => updateField(category, "pending", event.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Accomplished</Label>
                      <Input
                        type="number"
                        min={0}
                        value={breakdown[category].accomplished}
                        onChange={(event) =>
                          updateField(category, "accomplished", event.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save entry</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default NoticeAddModal;
