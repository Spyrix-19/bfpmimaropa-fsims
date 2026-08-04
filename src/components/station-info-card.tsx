import * as React from "react";
import { Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import { cn } from "@/lib/utils";

/**
 * Shared "Station Information" presentation used across Compliance, Notices,
 * Target Reference and Logistics modules. Mirrors the BWC Details modal style:
 * section title, avatar + station name / unit code, then a row of read-only
 * fields. Purely presentational — no data fetching, no behavior.
 */

export function StationSectionTitle({
  icon = <Building2 className="h-4 w-4" />,
  title = "Station Information",
}: {
  icon?: React.ReactNode;
  title?: string;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border/60 pb-2">
      <span className="text-primary">{icon}</span>
      <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
        {title}
      </span>
    </div>
  );
}

export function StationReadOnlyField({
  label,
  value,
  className,
}: {
  label: string;
  value?: React.ReactNode;
  className?: string;
}) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 flex h-9 items-center rounded-md border border-border/60 bg-muted/30 px-3 text-sm font-medium",
          empty && "text-muted-foreground",
        )}
      >
        <span className="truncate">{empty ? "—" : value}</span>
      </div>
    </div>
  );
}

export interface StationInfoCardProps {
  stationName?: string | null;
  /** Small primary-colored line under the station name (unit / station code). */
  unitCode?: string | null;
  logoUrl?: string | null;
  /** Read-only fields rendered in the grid. Defaults to code / city / province. */
  fields?: { label: string; value?: React.ReactNode }[];
  cityName?: string | null;
  provinceName?: string | null;
  /** Extra controls (e.g. pickers) rendered under the read-only grid. */
  children?: React.ReactNode;
  title?: string;
  className?: string;
}

export default function StationInfoCard({
  stationName,
  unitCode,
  logoUrl,
  fields,
  cityName,
  provinceName,
  children,
  title = "Station Information",
  className,
}: StationInfoCardProps) {
  const resolvedFields = fields ?? [
    { label: "Unit Code", value: unitCode ?? "" },
    { label: "City / Municipality", value: cityName ?? "" },
    { label: "Province", value: provinceName ?? "" },
  ];

  return (
    <Card className={cn("space-y-4 border-border/60 bg-card p-4 shadow-soft", className)}>
      <StationSectionTitle title={title} />
      <div className="flex items-center gap-2">
        <AvatarWithFallback
          entity={{ name: stationName || "Station" }}
          name={stationName || "?"}
          src={logoUrl || undefined}
          alt={stationName || "Station"}
          className="h-14 w-14 shrink-0 border border-border/60"
        />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold leading-tight">{stationName || "—"}</div>
          {unitCode ? (
            <div className="text-xs font-medium leading-tight text-primary">{unitCode}</div>
          ) : null}
        </div>
      </div>
      {resolvedFields.length > 0 && (
        <div
          className={cn(
            "grid gap-3",
            resolvedFields.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
          )}
        >
          {resolvedFields.map((f) => (
            <StationReadOnlyField key={f.label} label={f.label} value={f.value} />
          ))}
        </div>
      )}
      {children}
    </Card>
  );
}
