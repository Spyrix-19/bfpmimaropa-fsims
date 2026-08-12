import * as React from "react";
import { displayNumber } from "@/lib/utils";
import { Building2, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import { StatBox } from "@/components/stat-box";
import type { InspectorField, InspectorRow } from "../FireSafetyInspector";
import { num, rowTotal } from "../inspectorexport";
import { useAuth } from "@/lib/auth";
import { canShowEditAction } from "@/lib/permissions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: InspectorRow | null;
  fields: InspectorField[];
  entityLabel: string;
  totalLabel: string;
  icon: React.ReactNode;
  onEdit?: () => void;
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

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 flex h-9 items-center rounded-md border border-border/60 bg-muted/30 px-3 text-sm font-medium">
        {value}
      </div>
    </div>
  );
}

/** Read-only details view for a Fire Safety Inspector station record. */
export default function InspectorView({
  open,
  onOpenChange,
  row,
  fields,
  entityLabel,
  totalLabel,
  icon,
  onEdit,
}: Props) {
  const { user, systemAccess } = useAuth();
  const canEdit = canShowEditAction(user, systemAccess);
  const total = row ? rowTotal(row, fields) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="flex max-h-[90vh] w-[95vw] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:rounded-xl"
      >
        <DialogHeader className="space-y-1 border-b border-border/60 bg-card px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Eye className="h-4 w-4 text-primary" />
            {entityLabel} Details
          </DialogTitle>
          <DialogDescription className="text-xs">
            View only — values are displayed as recorded and cannot be modified here.
          </DialogDescription>
        </DialogHeader>

        {row && (
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto bg-muted/20 px-5 py-5">
            <Card className="space-y-4 border-border/60 bg-card p-4 shadow-soft">
              <SectionTitle icon={<Building2 className="h-4 w-4" />} title="Station Information" />
              <div className="flex items-center gap-2">
                <AvatarWithFallback
                  name={row.stationname}
                  src={row.logourl ?? null}
                  alt={row.stationname}
                  className="h-14 w-14 shrink-0 border border-border/60"
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold leading-tight">
                    {row.stationname}
                  </div>
                  <div className="text-xs font-medium text-primary leading-tight">
                    {row.unitcode}
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <DetailField label="Unit Code" value={row.unitcode} />
                <DetailField label="City / Municipality" value={row.cityname} />
                <DetailField label="Province" value={row.provincename} />
              </div>
            </Card>

            <Card className="space-y-4 border-border/60 bg-card p-4 shadow-soft">
              <SectionTitle icon={icon} title={`${entityLabel} Breakdown`} />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {fields.map((f) => (
                  <StatBox key={f.key} label={f.label} value={displayNumber(num(row, f.key))} tone={f.tone} />
                ))}
                <StatBox label={totalLabel} value={displayNumber(total)} tone="primary" />
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {fields.map((f) => {
                    const value = num(row, f.key);
                    const share = total > 0 ? Math.round((value / total) * 100) : 0;
                    return (
                      <tr key={f.key}>
                        <td className="border-b border-border/60 px-3 py-2">{f.label}</td>
                        <td className="border-b border-border/60 px-3 py-2 text-right tabular-nums font-semibold">
                          {displayNumber(value).toLocaleString()}
                        </td>
                        <td className="w-24 border-b border-border/60 px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {share}%
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="total-row font-bold">
                    <td className="border-b border-border/60 px-3 py-2">{totalLabel}</td>
                    <td className="border-b border-border/60 px-3 py-2 text-right tabular-nums">
                      {displayNumber(total).toLocaleString()}
                    </td>
                    <td className="border-b border-border/60 px-3 py-2 text-right tabular-nums">
                      100%
                    </td>
                  </tr>
                </tbody>
              </table>
            </Card>
          </div>
        )}

        <DialogFooter className="gap-2 border-t border-border/60 bg-card px-5 py-3">
          {onEdit && canEdit && (
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onEdit();
              }}
            >
              Edit
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
