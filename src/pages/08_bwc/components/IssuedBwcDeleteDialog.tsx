import type { ComponentProps } from "react";
import BwcDeleteDialog from "./BwcDeleteDialog";

export default function IssuedBwcDeleteDialog(props: ComponentProps<typeof BwcDeleteDialog>) {
  return <BwcDeleteDialog {...props} />;
}
