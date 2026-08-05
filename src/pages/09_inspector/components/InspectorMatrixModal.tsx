import type { ComponentProps } from "react";
import BwcMatrixModal from "../../08_bwc/components/BwcMatrixModal";

export default function InspectorMatrixModal(props: ComponentProps<typeof BwcMatrixModal>) {
  return <BwcMatrixModal {...props} />;
}
