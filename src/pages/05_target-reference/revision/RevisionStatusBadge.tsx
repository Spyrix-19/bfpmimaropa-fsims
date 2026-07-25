import * as React from "react";
import { cn } from "@/lib/utils";
import { STATUS_PILL_BASE, statusTone } from "@/lib/theme";
import { REVISION_STATUS_LABEL, type RevisionStatus } from "./types";

export default function RevisionStatusBadge({
  status,
  className,
}: {
  status: RevisionStatus;
  className?: string;
}) {
  return (
    <span className={cn(STATUS_PILL_BASE, statusTone(status), className)}>
      {REVISION_STATUS_LABEL[status]}
    </span>
  );
}
