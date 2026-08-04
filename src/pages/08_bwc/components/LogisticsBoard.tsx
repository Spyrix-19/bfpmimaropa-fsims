import * as React from "react";
import { Building2, Download, Eye, LayoutGrid, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SearchKey from "@/components/search-key";
import FilterField from "@/components/filter-field";
import ResetFiltersButton from "@/components/reset-filters-button";
import EditButton from "@/components/edit-button";
import DeleteButton from "@/components/delete-button";
import PaginationControls from "@/components/pagination";
import { usePagination } from "@/hooks/usePagination";
import { toast } from "@/lib/toast";
import { StatBox } from "./StatBox";
import type { StationInfo } from "@/mock/logistics.mock";

export interface LogisticsStat {
  label: string;
  value: (row: never) => number;
  tone?: "muted" | "success" | "destructive" | "primary";
}

interface Props<T extends StationInfo> {
  title: string;
  description: string;
  icon: React.ReactNode;
  addLabel: string;
  matrixLabel: string;
  rows: T[];
  stats: { label: string; get: (row: T) => number; tone?: "muted" | "success" | "destructive" | "primary" }[];
}

function StationHeading({ station }: { station: StationInfo }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border/60 bg-muted/50">
        <Building2 className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold leading-tight">{station.stationname}</div>
        <div className="truncate text-xs text-muted-foreground">
          {station.cityname}, {station.provincename}
        </div>
      </div>
    </div>
  );
}

export default function LogisticsBoard<T extends StationInfo>({
  title,
  description,
  icon,
  addLabel,
  matrixLabel,
  rows,
  stats,
}: Props<T>) {
  const [searchkey, setSearchkey] = React.useState("");
  const [province, setProvince] = React.useState("ALL");
  const [station, setStation] = React.useState("ALL");
  const { page, setPage, pageSize, setPageSize } = usePagination({ initialPageSize: 10 });

  const provinces = React.useMemo(
    () => Array.from(new Set(rows.map((r) => r.provincename))).sort(),
    [rows],
  );
  const stations = React.useMemo(
    () =>
      rows
        .filter((r) => province === "ALL" || r.provincename === province)
        .map((r) => r.stationname)
        .sort(),
    [rows, province],
  );

  const filtered = React.useMemo(() => {
    const key = searchkey.trim().toLowerCase();
    return rows.filter((r) => {
      if (province !== "ALL" && r.provincename !== province) return false;
      if (station !== "ALL" && r.stationname !== station) return false;
      if (!key) return true;
      return `${r.stationname} ${r.cityname} ${r.provincename}`.toLowerCase().includes(key);
    });
  }, [rows, searchkey, province, station]);

  const total = filtered.length;
  const paged = React.useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  const handleReset = () => {
    setSearchkey("");
    setProvince("ALL");
    setStation("ALL");
    setPage(1);
  };

  const soon = (action: string) => toast.info(`${action} will be available once the API is ready.`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold">
            {icon}
            {title}
          </h1>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:flex-row sm:items-center">
          <Button
            variant="outline"
            onClick={() => soon("Export")}
            className="w-full justify-center gap-2 !text-primary [&_svg]:text-primary hover:!bg-primary hover:!text-white hover:[&_svg]:text-white sm:w-auto"
          >
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button
            variant="outline"
            onClick={() => soon(matrixLabel)}
            className="w-full justify-center gap-2 !text-primary [&_svg]:text-primary hover:!bg-primary hover:!text-white hover:[&_svg]:text-white sm:w-auto"
          >
            <LayoutGrid className="h-4 w-4" /> {matrixLabel}
          </Button>
          <Button onClick={() => soon(addLabel)} className="w-full justify-center gap-2 sm:w-auto">
            <Plus className="h-4 w-4" /> {addLabel}
          </Button>
        </div>
      </div>

      <Card className="border-border/60 p-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
          <FilterField label="Search Key">
            <SearchKey
              value={searchkey}
              onChange={(v) => {
                setSearchkey(v);
                setPage(1);
              }}
              placeholder="Search station, city, or province"
              widthClass="w-full"
            />
          </FilterField>
          <FilterField label="Province">
            <Select
              value={province}
              onValueChange={(v) => {
                setProvince(v);
                setStation("ALL");
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="All Provinces" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Provinces</SelectItem>
                {provinces.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Station">
            <Select
              value={station}
              onValueChange={(v) => {
                setStation(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="All Stations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Stations</SelectItem>
                {stations.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <div className="flex justify-end">
            <ResetFiltersButton onReset={handleReset} />
          </div>
        </div>
      </Card>

      {paged.length === 0 ? (
        <Card className="border-border/60 p-10 text-center text-sm text-muted-foreground">
          No stations found. Adjust your filters and try again.
        </Card>
      ) : (
        <>
          <div className="hidden md:block">
            <div className="overflow-auto rounded border border-border/60">
              <table className="min-w-full border-separate border-spacing-0 text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-3 text-left">Station</th>
                    <th className="whitespace-nowrap px-3 py-3 text-left">City</th>
                    <th className="whitespace-nowrap px-3 py-3 text-left">Province</th>
                    {stats.map((s) => (
                      <th key={s.label} className="whitespace-nowrap px-3 py-3 text-right">
                        {s.label}
                      </th>
                    ))}
                    <th className="whitespace-nowrap px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((row) => (
                    <tr key={row.stationno} className="border-b border-border/60 hover:bg-muted/20">
                      <td className="px-3 py-3 align-middle">{row.stationname}</td>
                      <td className="px-3 py-3 align-middle">{row.cityname}</td>
                      <td className="px-3 py-3 align-middle">{row.provincename}</td>
                      {stats.map((s) => (
                        <td key={s.label} className="px-3 py-3 text-right align-middle font-semibold text-foreground">
                          {s.get(row)}
                        </td>
                      ))}
                      <td className="px-3 py-3 align-middle text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          <EditButton
                            icon={<Eye />}
                            ariaLabel="View"
                            tooltip="View"
                            onClick={() => soon("View")}
                          />
                          <EditButton tooltip="Edit" onClick={() => soon("Edit")} />
                          <DeleteButton tooltip="Delete" onClick={() => soon("Delete")} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 md:hidden">
            {paged.map((row) => (
              <Card
                key={row.stationno}
                className="group space-y-4 border-border/60 bg-card p-4 shadow-soft"
              >
                <StationHeading station={row} />
                <div className="grid grid-cols-3 gap-2">
                  {stats.map((s) => (
                    <StatBox key={s.label} label={s.label} value={s.get(row)} tone={s.tone} />
                  ))}
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
                  <EditButton
                    icon={<Eye />}
                    ariaLabel="View"
                    tooltip="View"
                    onClick={() => soon("View")}
                  />
                  <EditButton tooltip="Edit" onClick={() => soon("Edit")} />
                  <DeleteButton tooltip="Delete" onClick={() => soon("Delete")} />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <div className="border-t border-border/60 pt-3">
        <PaginationControls
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
}
