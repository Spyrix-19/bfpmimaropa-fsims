import { toast } from "@/lib/toast";
import type { InspectorField, InspectorRow } from "./inspectorTypes";
import { num, rowTotal } from "./inspectorTypes";

export interface BwcMatrixGroup {
  provincename: string;
  stations: InspectorRow[];
}

const csvCell = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;

/** Exports the Issued BWC matrix, grouped by province with province totals. */
export function exportInspectorMatrix(
  groups: BwcMatrixGroup[],
  fields: InspectorField[],
  totalLabel: string,
  title: string,
) {
  const sumOf = (list: InspectorRow[], key: string) => list.reduce((sum, r) => sum + num(r, key), 0);
  const sumTotal = (list: InspectorRow[]) => list.reduce((sum, r) => sum + rowTotal(r, fields), 0);

  const header = [
    "Province",
    "Station",
    "Unit Code",
    "City",
    ...fields.map((f) => f.label),
    totalLabel,
  ];
  const lines = [header.join(",")];
  groups.forEach((g) => {
    g.stations.forEach((r) => {
      lines.push(
        [
          g.provincename,
          r.stationname,
          r.unitcode,
          r.cityname,
          ...fields.map((f) => num(r, f.key)),
          rowTotal(r, fields),
        ]
          .map(csvCell)
          .join(","),
      );
    });
    lines.push(
      [
        `"${g.provincename} TOTAL"`,
        "",
        "",
        "",
        ...fields.map((f) => sumOf(g.stations, f.key)),
        sumTotal(g.stations),
      ].join(","),
    );
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/\s+/g, "-").toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Matrix exported.");
}
