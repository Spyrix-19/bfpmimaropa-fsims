import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { useFilters, type RefFilter } from "@/lib/filters";
import { MIMAROPA_REGION_CODE } from "@/lib/fsims-constants";
import LocationSearchSelect from "@/components/location-search-select";
import StationSearchSelect from "@/components/station-search-select";
import GentableSearchSelect from "@/components/gentable-search-select";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const EMPTY: RefFilter = { no: "all", name: "", code: "" };

export function FilterBar() {
  const { filters, setFilters, reset } = useFilters();
  const set = (patch: Partial<typeof filters>) => setFilters({ ...filters, ...patch });

  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <SlidersHorizontal className="h-4 w-4 text-primary" /> Dashboard Filters
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
        <Select value={filters.year} onValueChange={(v) => set({ year: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {["2023", "2024", "2025", "2026"].map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.semester}
          onValueChange={(v) => set({ semester: v as "all" | "1" | "2" })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Semester" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Semesters</SelectItem>
            <SelectItem value="1">1st Semester</SelectItem>
            <SelectItem value="2">2nd Semester</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.month} onValueChange={(v) => set({ month: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {MONTHS.map((m, i) => (
              <SelectItem key={m} value={String(i + 1)}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <LocationSearchSelect
          locationtype="PROVINCE"
          parentcode={MIMAROPA_REGION_CODE}
          value={filters.province.no !== "all" ? filters.province.no : undefined}
          valueName={filters.province.name}
          placeholder="All Provinces"
          onChange={(no, name, item) =>
            set({
              province: { no, name, code: item?.locationcode ?? "" },
              city: EMPTY,
              station: EMPTY,
            })
          }
        />

        <LocationSearchSelect
          locationtype="CITY"
          parentcode={filters.province.code ?? ""}
          value={filters.city.no !== "all" ? filters.city.no : undefined}
          valueName={filters.city.name}
          placeholder="All Cities"
          disabled={filters.province.no === "all"}
          onChange={(no, name, item) =>
            set({
              city: { no, name, code: item?.locationcode ?? "" },
              station: EMPTY,
            })
          }
        />

        <StationSearchSelect
          value={filters.station.no !== "all" ? filters.station.no : undefined}
          valueName={filters.station.name}
          placeholder="All Stations"
          onChange={(no, name) => set({ station: { no, name } })}
        />

        <GentableSearchSelect
          tablename="APPLICATION TYPE"
          value={filters.category.no !== "all" ? filters.category.no : undefined}
          valueName={filters.category.name}
          placeholder="All Categories"
          onChange={(no, name) => set({ category: { no, name } })}
        />
      </div>

      <div className="mt-3 flex justify-end">
        <Button variant="ghost" size="sm" onClick={reset}>
          <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset
        </Button>
      </div>
    </div>
  );
}
