import { ShieldCheck } from "lucide-react";
import LogisticsBoard from "../07_logistics/components/LogisticsBoard";
import {
  MOCK_FIRE_SAFETY_INSPECTORS,
  totalInspectors,
  type InspectorRow,
} from "@/mock/logistics.mock";

export default function FireSafetyInspectorPage() {
  return (
    <LogisticsBoard<InspectorRow>
      title="Fire Safety Inspector"
      description="Station-level Fire Safety Inspector training capability."
      icon={<ShieldCheck className="h-5 w-5 text-primary" />}
      addLabel="Add Inspector"
      matrixLabel="Inspector Matrix"
      rows={MOCK_FIRE_SAFETY_INSPECTORS}
      stats={[
        { label: "With Training", get: (r) => r.withTraining, tone: "success" },
        { label: "Without Training", get: (r) => r.withoutTraining, tone: "destructive" },
        { label: "Total Inspectors", get: totalInspectors, tone: "primary" },
      ]}
    />
  );
}
