import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Download, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { UniversalFilterBar } from "@/components/shared/UniversalFilterBar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AddButton from "@/components/add-button";
import PaginationControls from "@/components/pagination";
import ConfirmDialog from "@/components/ui/confirm-dialog";

export interface LedgerShellProps {
  title: string;
  icon: LucideIcon;
  description: string;
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder: string;
  filters?: React.ReactNode;
  activeFilterCount?: number;
  onReset?: () => void;
  addLabel?: string;
  onAdd?: () => void;
  /** Hide the Add button (e.g. read-only report pages). */
  hideAdd?: boolean;
  /** Name used in the "export unavailable" notice. */
  exportName: string;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  /** Ledger body (table, cards, loaders, empty states). */
  children: React.ReactNode;
  /** Extra dialogs/modals rendered after the ledger. */
  extras?: React.ReactNode;
}

/**
 * Shared ledger layout used by every module page (modelled on Critical
 * Facilities): header, one desktop card holding toolbar + ledger + pagination.
 */
export function LedgerShell(props: LedgerShellProps) {
  const [exportOpen, setExportOpen] = React.useState(false);
  const pagination = (
    <PaginationControls
      page={props.page}
      pageSize={props.pageSize}
      total={props.total}
      onPageChange={props.onPageChange}
      onPageSizeChange={props.onPageSizeChange}
    />
  );

  return (
    <div className="space-y-4">
      <PageHeader title={props.title} icon={props.icon} description={props.description} />

      <div className="space-y-4 md:rounded-xl md:border md:border-border/60 md:bg-card md:p-4 md:text-card-foreground md:shadow">
        <UniversalFilterBar
          className="md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none"
          search={props.search}
          onSearchChange={props.onSearchChange}
          searchPlaceholder={props.searchPlaceholder}
          filters={props.filters}
          activeFilterCount={props.activeFilterCount ?? 0}
          onReset={props.onReset}
          primaryAction={
            props.hideAdd ? undefined : (
              <AddButton className="w-full justify-center md:w-auto" onClick={props.onAdd}>
                <Plus className="h-4 w-4" />
                {props.addLabel ?? "Add Record"}
              </AddButton>
            )
          }
          secondaryAction={
            <Button
              type="button"
              variant="outline"
              onClick={() => setExportOpen(true)}
              className="w-full justify-center gap-2 md:w-auto"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          }
        />

        <Card className="overflow-hidden border-border/60 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none">
          {props.children}
          <div className="hidden md:block">{pagination}</div>
        </Card>
      </div>

      <div className="md:hidden">{pagination}</div>

      {props.extras}

      <ConfirmDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        ContentIcon={AlertTriangle}
        contentIconBgClass="tone-danger-soft"
        contentIconColorClass="text-destructive"
        title="Export is temporarily unavailable"
        description={`${props.exportName} export is currently on hold. Please contact your system administrator for assistance. This feature will be available soon.`}
        confirmLabel="OK"
        cancelClassName="hidden"
        onConfirm={() => setExportOpen(false)}
      />
    </div>
  );
}

/** Standard table frame used inside LedgerShell. */
export function LedgerTable({
  columns,
  children,
}: {
  columns: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto md:rounded-lg md:border md:border-border/60">
      <table className="w-full text-sm">
        <thead className="hidden bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground md:table-header-group">
          <tr>
            {columns.map((c) => (
              <th key={c} className="whitespace-nowrap px-4 py-2.5 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** Full-width message row (empty, loading, error) for LedgerTable. */
export function LedgerMessageRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="w-full p-0">
        <div className="mx-auto flex min-h-[200px] w-full items-center justify-center py-10">
          {children}
        </div>
      </td>
    </tr>
  );
}
