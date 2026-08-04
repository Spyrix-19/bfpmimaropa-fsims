import SecureDeleteDialog from "@/components/secure-delete-dialog";
import type { BwcRow } from "./bwcTypes";

interface Props {
  row: BwcRow | null;
  onOpenChange: (open: boolean) => void;
  deleting: boolean;
  onConfirm: () => void;
  entityLabel: string;
}

/** Delete confirmation for an Issued BWC station record. */
export default function BwcDeleteDialog({
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
