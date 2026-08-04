import * as React from "react";
import { Building2, Loader2, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import FilterField from "@/components/filter-field";
import { cn } from "@/lib/utils";
import type { BwcField, BwcRow } from "./bwcTypes";
import { num } from "./bwcTypes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = Add mode, row = Edit mode (same modal). */
  row: BwcRow | null;
  /** Station catalog used by the Add-mode station picker. */
  stations: BwcRow[];
  fields: BwcField[];
  entityLabel: string;
  totalLabel: string;
  icon: React.ReactNode;
  onSubmit: (row: BwcRow) => void;
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-border/60 pb-2">
      <span className="text-primary">{icon}</span>
      <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
        {title}
      </span>
    </div>
  );
}

export default function BwcFormModal({
  open,
  onOpenChange,
  row,
  stations,
  fields,
  entityLabel,
  totalLabel,
  icon,
  onSubmit,
}: Props) {
  const isEdit = row != null;
  const [stationno, setStationno] = React.useState("");
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setTouched(false);
    setSaving(false);
    setStationno(row?.stationno ?? "");
    setValues(Object.fromEntries(fields.map((f) => [f.key, row ? String(num(row, f.key)) : ""])));
  }, [open, row, fields]);

  const station = React.useMemo(
    () => stations.find((s) => s.stationno === stationno) ?? null,
    [stations, stationno],
  );

  const parsed = fields.map((f) => ({
    ...f,
    raw: values[f.key] ?? "",
    value: Number(values[f.key] ?? 0) || 0,
    invalid: values[f.key] !== "" && Number(values[f.key]) < 0,
  }));

  const total = parsed.reduce((sum, f) => sum + f.value, 0);
  const missingStation = !stationno;
  const hasInvalid = parsed.some((f) => f.invalid);
  const canSave = !missingStation && !hasInvalid && !saving;

  const handleSave = () => {
    setTouched(true);
    if (!canSave || !station) return;
    setSaving(true);
    const next: BwcRow = {
      ...station,
      ...Object.fromEntries(parsed.map((f) => [f.key, f.value])),
    };
    window.setTimeout(() => {
      onSubmit(next);
      setSaving(false);
      onOpenChange(false);
    }, 250);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="flex max-h-[90vh] w-[95vw] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:rounded-xl"
      >
        <DialogHeader className="space-y-1 border-b border-border/60 bg-card px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            {icon}
            {isEdit ? `Edit ${entityLabel}` : `Add ${entityLabel}`}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isEdit
              ? "Update the station's recorded counts. Station information is locked."
              : "Select a station and record its counts."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto bg-muted/20 px-5 py-5">
          <Card className="space-y-4 border-border/60 bg-card p-4 shadow-soft">
            <SectionTitle icon={<Building2 className="h-4 w-4" />} title="Station Information" />
            {isEdit && station ? (
              <div className="flex items-start gap-3">
                <AvatarWithFallback
                  name={station.stationname}
                  src={station.logourl ?? null}
                  alt={station.stationname}
                  className="h-11 w-11 shrink-0 border border-border/60"
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{station.stationname}</div>
                  <div className="text-xs font-medium text-primary">{station.unitcode}</div>
                  <div className="text-xs text-muted-foreground">
                    {station.cityname}, {station.provincename}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <FilterField label="Station">
                  <Select value={stationno} onValueChange={setStationno}>
                    <SelectTrigger
                      className={cn("h-10", touched && missingStation && "border-destructive")}
                    >
                      <SelectValue placeholder="Select station" />
                    </SelectTrigger>
                    <SelectContent>
                      {stations.map((s) => (
                        <SelectItem key={s.stationno} value={s.stationno}>
                          {s.stationname}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>
                {touched && missingStation && (
                  <p className="text-xs text-destructive">Station is required.</p>
                )}
                {station && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      { label: "Unit Code", value: station.unitcode },
                      { label: "City / Municipality", value: station.cityname },
                      { label: "Province", value: station.provincename },
                    ].map((f) => (
                      <div key={f.label}>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                          {f.label}
                        </div>
                        <div className="text-sm font-semibold">{f.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>

          <Card className="space-y-4 border-border/60 bg-card p-4 shadow-soft">
            <SectionTitle icon={icon} title={`${entityLabel} Counts`} />
            <div className="grid gap-4 sm:grid-cols-2">
              {parsed.map((f) => (
                <FilterField key={f.key} label={f.label}>
                  <Input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={f.raw}
                    onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder="0"
                    className={cn("h-10 tabular-nums", f.invalid && "border-destructive")}
                  />
                  {f.hint && !f.invalid && (
                    <p className="text-[11px] text-muted-foreground">{f.hint}</p>
                  )}
                  {f.invalid && (
                    <p className="text-[11px] text-destructive">Must be zero or greater.</p>
                  )}
                </FilterField>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-lg border border-primary/40 bg-primary/10 px-3 py-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-primary">
                {totalLabel}
              </span>
              <span className="text-lg font-bold tabular-nums text-primary">{total}</span>
            </div>
          </Card>
        </div>

        <DialogFooter className="gap-2 border-t border-border/60 bg-card px-5 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : isEdit ? "Save Changes" : `Add ${entityLabel}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
