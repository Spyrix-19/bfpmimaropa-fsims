import { Radio } from "lucide-react";
import LogisticsBoard from "./components/LogisticsBoard";
import { MOCK_ISSUED_BWC, totalIssued, type IssuedBwcRow } from "@/mock/logistics.mock";

export default function IssuedBwcPage() {
  return (
    <LogisticsBoard<IssuedBwcRow>
      title="Issued BWC"
      description="Station-level inventory of issued body-worn cameras."
      icon={<Radio className="h-5 w-5 text-primary" />}
      addLabel="Add BWC"
      matrixLabel="BWC Matrix"
      rows={MOCK_ISSUED_BWC}
      stats={[
        { label: "Working", get: (r) => r.working, tone: "success" },
        { label: "BER", get: (r) => r.ber, tone: "destructive" },
        { label: "Total Issued", get: totalIssued, tone: "primary" },
      ]}
    />
  );
}
