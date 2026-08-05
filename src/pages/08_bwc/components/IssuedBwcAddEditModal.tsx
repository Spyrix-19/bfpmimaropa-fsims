import type { ComponentProps } from "react";
import BwcFormModal from "./BwcFormModal";

export default function IssuedBwcAddEditModal(props: ComponentProps<typeof BwcFormModal>) {
  return <BwcFormModal {...props} />;
}
