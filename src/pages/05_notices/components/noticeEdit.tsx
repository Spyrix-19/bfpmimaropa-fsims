import * as React from "react";
import { PencilLine, Loader2 } from "lucide-react";

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
import { toast } from "@/lib/toast";
import { unwrap } from "@/lib/api-envelope";
import { useAuth } from "@/lib/auth";
import { noticeAPI } from "@/services/noticeAPI";
import type { NoticeRecord } from "@/pages/05_notices/Notice";
import type { NoticeCategory, NoticeCategoryCounts } from "@/types/noticeType";

const CATEGORY_LABEL: Record<NoticeCategory, string> = {
  NOD: "NOD",
  NTC: "NTC",
  NTCV: "NTCV",
  Abatement: "Abatement",
  Closure: "Closure",
};

const NOTICE_CATEGORIES: NoticeCategory[] = ["NOD", "NTC", "NTCV", "Abatement", "Closure"];

function emptyBreakdown(): Record<NoticeCategory, NoticeCategoryCounts> {
  return NOTICE_CATEGORIES.reduce(
    (acc, category) => ({ ...acc, [category]: { pending: 0, accomplished: 0 } }),
    {} as Record<NoticeCategory, NoticeCategoryCounts>,
  );
}

interface NoticeEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: NoticeRecord | null;
  onSaved: () => void;
}

export function NoticeEditModal({ open, onOpenChange, record, onSaved }: NoticeEditModalProps) {
  const { user } = useAuth();
  const [days, setDays] = React.useState<Array<{ day: number; date: string; remarks: string; breakdown: Record<NoticeCategory, NoticeCategoryCounts> }>>([]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!record || !open) return;
    const nextDays = record.dailyEntries.map((entry) => ({
      day: entry.day,
      date: entry.date,
      remarks: entry.remarks,
      breakdown: entry.breakdown,
    }));
    setDays(nextDays.length ? nextDays : [{ day: 1, date: `${record.reportYear}-${String(record.reportMonth).padStart(2, "0")}-01`, remarks: "", breakdown: emptyBreakdown() }]);
  }, [record, open]);

  if (!record) return null;

  const updateField = (day: number, category: NoticeCategory, field: keyof NoticeCategoryCounts, value: string) => {
    const parsed = Number(value) || 0;
    setDays((prev) => prev.map((entry) => (entry.day === day ? { ...entry, breakdown: { ...entry.breakdown, [category]: { ...entry.breakdown[category], [field]: parsed } } } : entry)));
  };

  const updateRemarks = (day: number, value: string) => {
    setDays((prev) => prev.map((entry) => (entry.day === day ? { ...entry, remarks: value } : entry)));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        noticeno: "",
        stationno: record.stationno,
        dateaccomplish: `${days[0]?.date || `${record.reportYear}-${String(record.reportMonth).padStart(2, "0")}-01`}T00:00:00`,
        encodedby: user?.memberno ?? "anon",
        accomnoticeList: days.map((entry) => ({
          accomplishno: "",
          noticeno: "",
          fsicmode: 0,
          nodcount: entry.breakdown.NOD.pending,
          ntccount: entry.breakdown.NTC.pending,
          ntcvcount: entry.breakdown.NTCV.pending,
          abatementcount: entry.breakdown.Abatement.pending,
          closurecount: entry.breakdown.Closure.pending,
        })),
      };
      const resp = await noticeAPI.create(payload, { suppressGlobalLoading: true });
      const { ok, error } = unwrap(resp);
      if (!ok) {
        toast.error(error || "Unable to update notice entry.");
        return;
      }
      toast.success("Notice entry updated.");
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PencilLine className="h-5 w-5 text-primary" /> Edit Notice Ledger
          </DialogTitle>
          <DialogDescription>Update the notice entries for {record.stationname} in {record.reportYear}/{record.reportMonth}.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="overflow-x-auto rounded-lg border border-border/70">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/60 text-left">
                <tr>
                  <th className="px-2 py-2">Day</th>
                  <th className="px-2 py-2">Remarks</th>
                  {NOTICE_CATEGORIES.map((category) => (
                    <th key={category} className="px-2 py-2 text-center">{CATEGORY_LABEL[category]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((entry) => (
                  <tr key={entry.day} className="border-t border-border/60">
                    <td className="px-2 py-2 font-semibold">{entry.day}</td>
                    <td className="px-2 py-2">
                      <Input value={entry.remarks} onChange={(event) => updateRemarks(entry.day, event.target.value)} className="min-w-[140px]" />
                    </td>
                    {NOTICE_CATEGORIES.map((category) => (
                      <td key={`${entry.day}-${category}`} className="px-2 py-2">
                        <div className="grid gap-1">
                          <Label className="text-[10px]">P</Label>
                          <Input type="number" min={0} value={entry.breakdown[category].pending} onChange={(event) => updateField(entry.day, category, "pending", event.target.value)} className="h-8" />
                          <Label className="text-[10px]">A</Label>
                          <Input type="number" min={0} value={entry.breakdown[category].accomplished} onChange={(event) => updateField(entry.day, category, "accomplished", event.target.value)} className="h-8" />
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
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save month"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default NoticeEditModal;
