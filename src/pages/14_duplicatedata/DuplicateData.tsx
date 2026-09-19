import * as React from "react";
import { AlertTriangle, DatabaseZap, Loader2, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { unwrap } from "@/lib/api-envelope";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import PaginationControls from "@/components/pagination";
import { usePagination } from "@/hooks/usePagination";
import { StickyPageTop } from "@/components/shared/StickyPageTop";
import { duplicateRecordAPI } from "@/services/duplicaterecordAPI";
import type { DuplicateDataMonitoringModel } from "@/types/duplicaterecordType";

const normalizeRow = (row: DuplicateDataMonitoringModel) => ({
  primarykey: row.primarykey ?? row.Primarykey ?? "",
  stationno: row.stationno ?? row.Stationno ?? "",
  stationcode: row.stationcode ?? row.Stationcode ?? "",
  stationname: row.stationname ?? row.Stationname ?? "",
  logourl: row.logourl ?? row.Logourl ?? "",
  provincename: row.provincename ?? row.Provincename ?? "",
  recordtype: row.recordtype ?? row.Recordtype ?? "",
});

export default function DuplicateData() {
  const { isSuperAdmin } = useAuth();
  const { page, setPage, pageSize, setPageSize } = usePagination({ initialPageSize: 10 });
  const [rows, setRows] = React.useState<DuplicateDataMonitoringModel[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!isSuperAdmin()) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      const resp = await duplicateRecordAPI.getDuplicateDataMonitoring(
        { pagenumber: page, pagesize: pageSize },
        { suppressGlobalLoading: true },
      );

      if (cancelled) return;

      const { ok, data, total: totalCount, error } = unwrap<DuplicateDataMonitoringModel[]>(resp);
      if (!ok) {
        setRows([]);
        setTotal(0);
        setLoading(false);
        return;
      }

      const list = Array.isArray(data) ? data.map(normalizeRow) : [];
      setRows(list);
      setTotal(totalCount || list.length);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, page, pageSize]);

  if (!isSuperAdmin()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card className="border border-destructive/40 bg-destructive/5 p-6 text-center shadow-soft">
          <div className="mb-3 flex justify-center text-destructive">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-semibold">Access restricted</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Duplicate Data is available only to Super Administrators.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StickyPageTop>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-bold">
              <DatabaseZap className="h-5 w-5 text-primary" />
              Duplicate Data
            </h1>
            <p className="text-xs text-muted-foreground">
              Review duplicate records by station and record type across the Fire Safety collection
              ledger.
            </p>
          </div>
        </div>
      </StickyPageTop>

      {loading ? (
        <Card className="flex items-center justify-center gap-2 border-border/60 p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading duplicate records…
        </Card>
      ) : (
        <Card className="overflow-hidden border-border/60 bg-card shadow-soft">
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="bg-muted/60 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="border-b border-border/60 px-4 py-3">Primary Key</th>
                  <th className="border-b border-border/60 px-4 py-3">Station</th>
                  <th className="border-b border-border/60 px-4 py-3">Record Type</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-10 text-center text-sm text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                        No duplicate records found.
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const stationName = row.stationname ?? row.Stationname ?? "Unknown Station";
                    const stationCode = row.stationcode ?? row.Stationcode ?? "—";
                    const provinceName = row.provincename ?? row.Provincename ?? "";
                    const primaryKey = row.primarykey ?? row.Primarykey ?? "";
                    const recordType = row.recordtype ?? row.Recordtype ?? "Unspecified";
                    const logoUrl = row.logourl ?? row.Logourl ?? undefined;

                    return (
                      <tr
                        key={`${primaryKey}-${stationName}-${recordType}`}
                        className="align-middle hover:bg-muted/30"
                      >
                        <td className="border-b border-border/60 px-4 py-3 font-medium text-foreground">
                          {primaryKey || "—"}
                        </td>
                        <td className="border-b border-border/60 px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="shrink-0 rounded-full border border-border/60 bg-muted/40 p-1">
                              <AvatarWithFallback
                                name={stationName}
                                src={logoUrl || undefined}
                                className="h-9 w-9"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-medium text-foreground">
                                {stationName}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {stationCode}
                              </div>
                              <div className="truncate text-[11px] text-muted-foreground/80">
                                {provinceName}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="border-b border-border/60 px-4 py-3">
                          <span className="inline-flex rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
                            {recordType}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
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
