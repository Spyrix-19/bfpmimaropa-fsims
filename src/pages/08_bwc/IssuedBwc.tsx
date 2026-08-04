import { Radio } from "lucide-react";
import BwcLedger from "./components/BwcLedger";
import { MOCK_ISSUED_BWC } from "@/mock/logistics.mock";

export default function IssuedBwcPage() {
  return (
    <BwcLedger
      title="Issued BWC"
      description="Station-level inventory of issued body-worn cameras."
      icon={<Radio className="h-5 w-5 text-primary" />}
      entityLabel="BWC"
      addLabel="Add BWC"
      matrixLabel="BWC Matrix"
      matrixTitle="Issued BWC Matrix"
      totalLabel="Total Issued"
      rows={MOCK_ISSUED_BWC}
      fields={[
        { key: "working", label: "Working", tone: "success", hint: "Units currently serviceable." },
        { key: "ber", label: "BER", tone: "destructive", hint: "Beyond economical repair." },
      ]}
    />
  );
}
