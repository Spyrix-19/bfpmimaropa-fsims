import type { ComponentProps } from "react";
import BwcMatrixModal from "./BwcMatrixModal";

export default function IssuedBwcMatrixModal(props: ComponentProps<typeof BwcMatrixModal>) {
  return <BwcMatrixModal {...props} />;
}
