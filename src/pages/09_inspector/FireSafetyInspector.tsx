import { ShieldCheck } from "lucide-react";
import BwcLedger from "../08_bwc/components/BwcLedger";
import { inspectorLogisticsApi } from "@/lib/logisticsApi";

export default function FireSafetyInspectorPage() {
  return (
    <BwcLedger
      title="Fire Safety Inspector"
      description="Station-level Fire Safety Inspector training capability."
      icon={<ShieldCheck className="h-5 w-5 text-primary" />}
      entityLabel="Inspector"
      addLabel="Add Inspector"
      totalLabel="Total Inspectors"
      api={inspectorLogisticsApi}
      fields={[
        {
          key: "withtrainingcount",
          label: "With Training",
          shortLabel: "W/ Training",
          tone: "success",
          hint: "Inspectors with completed FSIC training.",
        },
        {
          key: "withouttrainingcount",
          label: "Without Training",
          shortLabel: "W/O Training",
          tone: "destructive",
          hint: "Inspectors pending training.",
        },
      ]}
    />
  );
}
