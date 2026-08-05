import type { ComponentProps } from "react";
import BwcLedger from "../../08_bwc/components/BwcLedger";

export default function InspectorLedger(props: ComponentProps<typeof BwcLedger>) {
  return <BwcLedger {...props} />;
}
