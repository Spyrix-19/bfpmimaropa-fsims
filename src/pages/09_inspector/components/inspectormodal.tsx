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
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import FilterField from "@/components/filter-field";
import StationSearchSelect from "@/components/station-search-select";
import type { SearchStationModel } from "@/types/stationTypes";
import { cn } from "@/lib/utils";
import { useAuth, resolveLocationScope } from "@/lib/auth";
import type { InspectorField, InspectorRow } from "../FireSafetyInspector";
import { num } from "../inspectorexport";

export interface InspectorFormSubmit {
  recordno: string;
  stationno: string;
  values: Record<string, number>;
  remarks: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = Add mode, row = Edit mode (same modal). */
  row: InspectorRow | null;
  fields: InspectorField[];
  entityLabel: string;
  totalLabel: string;
  icon: React.ReactNode;
  /** Persists the record; resolve true to close the modal. */
  onSubmit: (payload: InspectorFormSubmit) => Promise<boolean>;
  /** Fires when the user picks a station in add mode. */
  onStationSelected?: (
    stationno: string,
    stationname: string,
    province?: string,
    picked?: SearchStationModel,
  ) => void | Promise<void>;
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

/** Add / Edit modal for a Fire Safety Inspector station record. */
export default function InspectorModal({
  open,
  onOpenChange,
  row,
  fields,
  entityLabel,
  totalLabel,
  icon,
  onSubmit,
  onStationSelected,
}: Props) {
  const isEdit = row != null;
  const { user, systemAccess } = useAuth();
  const scope = React.useMemo(
    () => resolveLocationScope(user, systemAccess?.roleno),
    [user, systemAccess?.roleno],
  );
  // roleno 3 (personnel) => station is fixed to their own station.
  const stationLocked = scope.roleno === 3 && !!scope.stationno;
  // stationtype 27 admins are scoped to their province; 25/26 admins search all.
  const scopedProvinceno = stationLocked ? undefined : scope.provinceno || undefined;
  const [stationno, setStationno] = React.useState("");
  const [station, setStation] = React.useState<{
    stationname: string;
    unitcode: string;
    cityname: string;
    provincename: string;
    logourl?: string | null;
  } | null>(null);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [remarks, setRemarks] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setTouched(false);
    setSaving(false);
    setStationno(row?.stationno ?? "");
    setRemarks(String(row?.remarks ?? ""));
    setStation(
      row
        ? {
            stationname: row.stationname,
            unitcode: row.unitcode,
            cityname: row.cityname,
            provincename: row.provincename,
            logourl: row.logourl ?? null,
          }
        : null,
    );
    setValues(Object.fromEntries(fields.map((f) => [f.key, row ? String(num(row, f.key)) : ""])));

    if (!row && stationLocked) {
      setStationno(scope.stationno);
      setStation({
        stationname: user?.stationname ?? scope.stationname,
        unitcode: user?.stationcode ?? "",
        cityname: user?.cityname ?? "",
        provincename: user?.provincename ?? scope.provincename,
        logourl: null,
      });
      void onStationSelected?.(scope.stationno, user?.stationname ?? scope.stationname, user?.provincename ?? scope.provincename);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, row, fields, stationLocked, scope.stationno]);

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

  const handleStationPick = (
    nextNo: string,
    name: string,
    province?: string,
    picked?: SearchStationModel,
  ) => {
    setStationno(nextNo);
    setStation(
      picked
        ? {
            stationname: picked.stationname,
            unitcode: picked.stationcode,
            cityname: picked.cityname,
            provincename: picked.provincename,
            logourl: picked.logourl,
          }
        : null,
    );
    void onStationSelected?.(nextNo, name, province, picked);
  };

  const handleSave = async () => {
    setTouched(true);
    if (!canSave) return;
    setSaving(true);
    const ok = await onSubmit({
      recordno: String(row?.recordno ?? ""),
      stationno,
      values: Object.fromEntries(parsed.map((f) => [f.key, f.value])),
      remarks: remarks.trim(),
    });
    setSaving(false);
    if (ok) onOpenChange(false);
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
            {(isEdit || (stationLocked && station)) && station ? (
              <div className="space-y-4">
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
                    {[station.cityname, station.provincename].filter(Boolean).join(", ")}
                  </div>
                </div>
              </div>
              {!isEdit && (
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Station Code", value: station.unitcode },
                    { label: "Station Name", value: station.stationname },
                    { label: "Province", value: station.provincename },
                  ].map((f) => (
                    <FilterField key={f.label} label={f.label}>
                      <Input value={f.value ?? ""} readOnly className="h-10 bg-muted/40" />
                    </FilterField>
                  ))}
                </div>
              )}
              </div>
            ) : (
              <>
                <FilterField label="Station">
                  <StationSearchSelect
                    value={stationno}
                    valueName={station?.stationname}
                    provinceno={scopedProvinceno}
                    onChange={handleStationPick}
                    placeholder="Select station"
                    className={cn(touched && missingStation && "border-destructive")}
                  />
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
            <FilterField label="Remarks">
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional remarks"
                className="min-h-[72px]"
              />
            </FilterField>
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
