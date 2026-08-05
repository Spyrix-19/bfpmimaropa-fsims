import type { ComponentProps } from "react";
import BwcDeleteDialog from "../../08_bwc/components/BwcDeleteDialog";

export default function InspectorDeleteDialog(props: ComponentProps<typeof BwcDeleteDialog>) {
  return <BwcDeleteDialog {...props} />;
}
