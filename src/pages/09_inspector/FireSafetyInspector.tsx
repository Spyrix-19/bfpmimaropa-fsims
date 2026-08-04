import { ShieldCheck } from "lucide-react";
import InspectorLedger from "./components/InspectorLedger";
import { MOCK_FIRE_SAFETY_INSPECTORS } from "@/mock/logistics.mock";

export default function FireSafetyInspectorPage() {
  return (
    <InspectorLedger
      title="Fire Safety Inspector"
      description="Station-level Fire Safety Inspector training capability."
      icon={<ShieldCheck className="h-5 w-5 text-primary" />}
      entityLabel="Inspector"
      addLabel="Add Inspector"
      matrixLabel="Inspector Matrix"
      matrixTitle="Fire Safety Inspector Matrix"
      totalLabel="Total Inspectors"
      rows={MOCK_FIRE_SAFETY_INSPECTORS}
      fields={[
        {
          key: "withTraining",
          label: "With Training",
          shortLabel: "W/ Training",
          tone: "success",
          hint: "Inspectors with completed FSIC training.",
        },
        {
          key: "withoutTraining",
          label: "Without Training",
          shortLabel: "W/O Training",
          tone: "destructive",
          hint: "Inspectors pending training.",
        },
      ]}
    />
  );
}
