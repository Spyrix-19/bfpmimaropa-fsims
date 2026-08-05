import type { ComponentProps } from "react";
import BwcDetailsModal from "../../08_bwc/components/BwcDetailsModal";

export default function InspectorViewModal(props: ComponentProps<typeof BwcDetailsModal>) {
  return <BwcDetailsModal {...props} />;
}
