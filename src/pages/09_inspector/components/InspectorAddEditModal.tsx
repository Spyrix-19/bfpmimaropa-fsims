import type { ComponentProps } from "react";
import BwcFormModal from "../../08_bwc/components/BwcFormModal";

export default function InspectorAddEditModal(props: ComponentProps<typeof BwcFormModal>) {
  return <BwcFormModal {...props} />;
}
