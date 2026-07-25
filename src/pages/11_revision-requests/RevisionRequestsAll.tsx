import * as React from "react";
import { Filter, ShieldCheck, Target, ClipboardList } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MONTHS } from "@/lib/fsims-constants";
import { useAuth } from "@/lib/auth";
import { buildYears } from "@/lib/utils";

import RevisionStatusBadge from "@/pages/05_target-reference/revision/RevisionStatusBadge";
import { useRevisionStore } from "@/pages/05_target-reference/revision/useRevisionStore";
import { listRequests } from "@/pages/05_target-reference/revision/mockStore";
import {
  REVISION_STATUS_LABEL,
  type RevisionModule,
  type RevisionRequest,
  type RevisionStatus,
} from "@/pages/05_target-reference/revision/types";

const STATUS_OPTIONS: (RevisionStatus | "ALL")[] = [
  "ALL",
  "PENDING",
  "APPROVED",
  "DENIED",
  "CANCELLED",
  "COMPLETED",
  "EXPIRED",
];

function fmtDT(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function monthName(m: number) {
  return MONTHS.find((x) => x.value === m)?.name ?? String(m);
}

interface Filters {
  status: RevisionStatus | "ALL";
  year: string;
  month: string;
  province: string;
  station: string;
  requestedBy: string;
}

const EMPTY_FILTERS: Filters = {
  status: "ALL",
  year: "all",
  month: "all",
  province: "",
  station: "",
  requestedBy: "",
};

function applyFilters(rows: RevisionRequest[], f: Filters) {
  return rows.filter((r) => {
    if (f.status !== "ALL" && r.status !== f.status) return false;
    if (f.year !== "all" && String(r.reportyear) !== f.year) return false;
    if (f.month !== "all" && String(r.reportmonth) !== f.month) return false;
    if (
      f.province &&
      !r.provincename.toLowerCase().includes(f.province.toLowerCase())
    )
      return false;
    if (
      f.station &&
      !`${r.stationcode} ${r.stationname}`
        .toLowerCase()
        .includes(f.station.toLowerCase())
    )
      return false;
    if (
      f.requestedBy &&
      !r.requestedByName.toLowerCase().includes(f.requestedBy.toLowerCase())
    )
      return false;
    return true;
  });
}

function FiltersBar({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  const YEARS = React.useMemo(buildYears, []);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    onChange({ ...filters, [k]: v });
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Filter className="h-3.5 w-3.5" /> Filters
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div>
          <Label className="text-[11px]">Status</Label>
          <Select
            value={filters.status}
            onValueChange={(v) => set("status", v as never)}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "ALL" ? "All statuses" : REVISION_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px]">Year</Label>
          <Select value={filters.year} onValueChange={(v) => set("year", v)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All years</SelectItem>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px]">Month</Label>
          <Select value={filters.month} onValueChange={(v) => set("month", v)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All months</SelectItem>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={String(m.value)}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px]">Province</Label>
          <Input
            value={filters.province}
            onChange={(e) => set("province", e.target.value)}
            placeholder="Contains…"
            className="h-9"
          />
        </div>
        <div>
          <Label className="text-[11px]">Station</Label>
          <Input
            value={filters.station}
            onChange={(e) => set("station", e.target.value)}
            placeholder="Code or name…"
            className="h-9"
          />
        </div>
        <div>
          <Label className="text-[11px]">Requested By</Label>
          <Input
            value={filters.requestedBy}
            onChange={(e) => set("requestedBy", e.target.value)}
            placeholder="Name…"
            className="h-9"
          />
        </div>
      </div>
    </div>
  );
}

function RequestsTable({ rows }: { rows: RevisionRequest[] }) {
  return (
    <div className="overflow-auto rounded-lg border border-border/60">
      <table className="min-w-full border-collapse text-xs">
        <thead className="bg-muted/50 uppercase tracking-wider text-[10px] text-primary">
          <tr>
            {[
              "Status",
              "Requested",
              "Year",
              "Month",
              "Province",
              "City",
              "Station Code",
              "Station Name",
              "Requested By",
              "Reason",
              "Reviewed By",
              "Reviewed",
            ].map((h) => (
              <th
                key={h}
                className="whitespace-nowrap border-b border-border/60 px-2 py-1.5 text-left font-semibold"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={12}
                className="py-10 text-center text-muted-foreground"
              >
                No revision requests match the current filters.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-b border-border/40 hover:bg-muted/30"
            >
              <td className="px-2 py-1.5">
                <RevisionStatusBadge status={r.status} />
              </td>
              <td className="whitespace-nowrap px-2 py-1.5">
                {fmtDT(r.requestedAt)}
              </td>
              <td className="px-2 py-1.5">{r.reportyear}</td>
              <td className="px-2 py-1.5">{monthName(r.reportmonth)}</td>
              <td className="px-2 py-1.5">{r.provincename || "—"}</td>
              <td className="px-2 py-1.5">{r.cityname || "—"}</td>
              <td className="px-2 py-1.5">{r.stationcode || "—"}</td>
              <td className="px-2 py-1.5">{r.stationname || "—"}</td>
              <td className="px-2 py-1.5">{r.requestedByName}</td>
              <td
                className="max-w-[240px] truncate px-2 py-1.5"
                title={r.reason}
              >
                {r.reason}
              </td>
              <td className="px-2 py-1.5">{r.reviewedByName || "—"}</td>
              <td className="whitespace-nowrap px-2 py-1.5">
                {fmtDT(r.reviewedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RevisionRequestsAll() {
  useRevisionStore();
  const { user, systemAccess } = useAuth();
  const roleno = Number(systemAccess?.roleno ?? 0);
  const stationtype = Number(user?.stationtype ?? 0);
  const isAuthorized =
    (roleno === 1 || roleno === 2) &&
    (stationtype === 25 || stationtype === 26);

  const [tab, setTab] = React.useState<RevisionModule>("target-reference");
  const [trFilters, setTrFilters] = React.useState<Filters>(EMPTY_FILTERS);
  const [monFilters, setMonFilters] = React.useState<Filters>(EMPTY_FILTERS);

  const all = listRequests();
  const targetRows = React.useMemo(
    () =>
      applyFilters(
        all.filter((r) => (r.module ?? "target-reference") === "target-reference"),
        trFilters,
      ),
    [all, trFilters],
  );
  const monitoringRows = React.useMemo(
    () => applyFilters(all.filter((r) => r.module === "monitoring"), monFilters),
    [all, monFilters],
  );

  if (!isAuthorized) {
    // Defense-in-depth; route guard already blocks unauthorized users.
    return (
      <div className="p-6 text-sm text-muted-foreground">
        You do not have access to this module.
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Revision Requests
        </h1>
        <p className="text-xs text-muted-foreground">
          Consolidated view of every revision request across Target Reference
          and Fire Safety Compliance (Monitoring).
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as RevisionModule)}>
        <TabsList>
          <TabsTrigger value="target-reference" className="gap-1.5">
            <Target className="h-3.5 w-3.5" />
            Target Reference
            <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {
                all.filter(
                  (r) => (r.module ?? "target-reference") === "target-reference",
                ).length
              }
            </span>
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" />
            Monitoring (Compliance)
            <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {all.filter((r) => r.module === "monitoring").length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="target-reference" className="mt-3 space-y-3">
          <FiltersBar filters={trFilters} onChange={setTrFilters} />
          <RequestsTable rows={targetRows} />
        </TabsContent>

        <TabsContent value="monitoring" className="mt-3 space-y-3">
          <FiltersBar filters={monFilters} onChange={setMonFilters} />
          <RequestsTable rows={monitoringRows} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
