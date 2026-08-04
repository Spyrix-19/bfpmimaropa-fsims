import SecureDeleteDialog from "@/components/secure-delete-dialog";
import type { InspectorRow } from "./inspectorTypes";

interface Props {
  row: InspectorRow | null;
  onOpenChange: (open: boolean) => void;
  deleting: boolean;
  onConfirm: () => void;
  entityLabel: string;
}

/** Delete confirmation for a Fire Safety Inspector station record. */
export default function InspectorDeleteDialog({
  row,
  onOpenChange,
  deleting,
  onConfirm,
  entityLabel,
}: Props) {
  return (
    <SecureDeleteDialog
      open={row != null}
      onOpenChange={onOpenChange}
      subject={row ? `${row.stationname} — ${entityLabel} record` : undefined}
      description={`This permanently removes the ${entityLabel.toLowerCase()} record for this station.`}
      deleting={deleting}
      onConfirm={onConfirm}
    />
  );
}
