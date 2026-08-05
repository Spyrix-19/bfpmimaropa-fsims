import type { ComponentProps } from "react";
import BwcLedger from "./BwcLedger";

export default function IssuedBwcLedger(props: ComponentProps<typeof BwcLedger>) {
  return <BwcLedger {...props} />;
}
