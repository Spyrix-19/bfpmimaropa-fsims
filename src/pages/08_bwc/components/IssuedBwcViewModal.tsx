import type { ComponentProps } from "react";
import BwcDetailsModal from "./BwcDetailsModal";

export default function IssuedBwcViewModal(props: ComponentProps<typeof BwcDetailsModal>) {
  return <BwcDetailsModal {...props} />;
}
