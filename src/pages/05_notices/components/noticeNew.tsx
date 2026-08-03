import * as React from "react";
import { CalendarPlus2, Loader2 } from "lucide-react";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface NoticeTypeOption {
  value: string;
  label: string;
}

interface NoticeAddModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: NoticeRecord | null;
  onSaved: () => void;
}

export function NoticeAddModal({ open, onOpenChange, record, onSaved }: NoticeAddModalProps) {
  const { user } = useAuth();
  const [noticeType, setNoticeType] = React.useState<string>("");
  const [date, setDate] = React.useState<string>("");
  const [remarks, setRemarks] = React.useState("");
  const [breakdown, setBreakdown] = React.useState<Record<NoticeCategory, NoticeCategoryCounts>>(emptyBreakdown());
  const [noticeTypes, setNoticeTypes] = React.useState<NoticeTypeOption[]>([]);
  const [loadingTypes, setLoadingTypes] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!record || !open) return;
    setDate(record.dailyEntries[0]?.date || `${record.reportYear}-${String(record.reportMonth).padStart(2, "0")}-01`);
    setRemarks("");
    setBreakdown(emptyBreakdown());
    setNoticeType("");
  }, [record, open]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingTypes(true);
      const resp = await noticeAPI.getNoticeTypes({ suppressGlobalLoading: true });
      const { ok, data, error } = unwrap<unknown[]>(resp);
      if (!cancelled) {
        if (ok) {
          const list = Array.isArray(data) ? data : [];
          const normalized = list.map((item: any, index: number) => {
            const value = item?.noticeTypeNo ?? item?.noticeTypeCode ?? item?.noticeTypeId ?? item?.code ?? item?.id ?? item?.value ?? index + 1;
            const label = item?.noticeTypeName ?? item?.name ?? item?.description ?? item?.label ?? item?.typeName ?? String(value);
            return { value: String(value), label: String(label) };
          });
          setNoticeTypes(normalized);
          if (normalized[0]) setNoticeType(normalized[0].value);
        } else {
          toast.error(error || "Unable to load notice types.");
        }
      }
      if (!cancelled) setLoadingTypes(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!record) return null;

  const updateField = (category: NoticeCategory, field: keyof NoticeCategoryCounts, value: string) => {
    const parsed = Number(value) || 0;
    setBreakdown((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: parsed,
      },
    }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        noticeno: "",
        stationno: record.stationno,
        dateaccomplish: `${date || `${record.reportYear}-${String(record.reportMonth).padStart(2, "0")}-01`}T00:00:00`,
        encodedby: user?.memberno ?? "anon",
        accomnoticeList: [
          {
            accomplishno: "",
            noticeno: "",
            fsicmode: Number(noticeType) || 0,
            nodcount: breakdown.NOD.pending,
            ntccount: breakdown.NTC.pending,
            ntcvcount: breakdown.NTCV.pending,
            abatementcount: breakdown.Abatement.pending,
            closurecount: breakdown.Closure.pending,
          },
        ],
      };
      const resp = await noticeAPI.create(payload, { suppressGlobalLoading: true });
      const { ok, error } = unwrap(resp);
      if (!ok) {
        toast.error(error || "Unable to save notice entry.");
        return;
      }
      toast.success("Notice entry saved.");
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus2 className="h-5 w-5 text-primary" /> Add Notice Ledger Entry
          </DialogTitle>
          <DialogDescription>
            Add a notice accomplishment entry for {record.stationname} for {record.reportYear}/{record.reportMonth}.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Accomplishment Date</Label>
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </div>
            <div>
              <Label>Notice Classification</Label>
              {loadingTypes ? (
                <div className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading types…
                </div>
              ) : (
                <Select value={noticeType} onValueChange={setNoticeType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select notice type" />
                  </SelectTrigger>
                  <SelectContent>
                    {noticeTypes.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <div>
            <Label>Reference / Remarks</Label>
            <Input value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Optional note for this notice entry" />
          </div>
          <div className="space-y-3 rounded-lg border border-border/70 p-3">
            <div className="text-sm font-semibold">Notice counts by category</div>
            <p className="text-xs text-muted-foreground">
              Enter the pending and accomplished counts for this notice submission.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {NOTICE_CATEGORIES.map((category) => (
                <div key={category} className="rounded-md border border-border/60 p-3">
                  <div className="mb-2 text-sm font-semibold">{CATEGORY_LABEL[category]}</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Pending</Label>
                      <Input type="number" min={0} value={breakdown[category].pending} onChange={(event) => updateField(category, "pending", event.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Accomplished</Label>
                      <Input type="number" min={0} value={breakdown[category].accomplished} onChange={(event) => updateField(category, "accomplished", event.target.value)} />
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
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save notice entry"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default NoticeAddModal;
