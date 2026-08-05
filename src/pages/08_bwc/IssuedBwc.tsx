import { Radio } from "lucide-react";
import BwcLedger from "./components/BwcLedger";
import { bwcLogisticsApi } from "@/lib/logisticsApi";

export default function IssuedBwcPage() {
  return (
    <BwcLedger
      title="Issued BWC"
      description="Station-level inventory of issued body-worn cameras."
      icon={<Radio className="h-5 w-5 text-primary" />}
      entityLabel="BWC"
      addLabel="Add BWC"
      totalLabel="Total Issued"
      api={bwcLogisticsApi}
      fields={[
        {
          key: "operationalcount",
          label: "Working",
          shortLabel: "Working",
          tone: "success",
          hint: "Units currently serviceable.",
        },
        {
          key: "nonoperationalcount",
          label: "BER",
          shortLabel: "BER",
          tone: "destructive",
          hint: "Beyond economical repair.",
        },
      ]}
    />
  );
}
