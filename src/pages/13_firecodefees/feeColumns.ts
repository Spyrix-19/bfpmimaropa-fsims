import type { FireCodeSectorKey } from "@/types/firecodefeesType";

/* ------------------------------------------------------------------ *
 * Column model of the Summary Accomplishment Report on Fire Code Fees
 * Collection (BFP-QSF-FSED-052E Rev.01). Crown = the grouped header,
 * leaves = the individual amount columns underneath it.
 * ------------------------------------------------------------------ */

export interface FeeCol {
  key: string;
  label: string;
}

export interface FeeGroup {
  label: string;
  /** BFP account code printed under the crown on the paper form. */
  code?: string;
  cols: FeeCol[];
}

export const FEE_GROUPS: FeeGroup[] = [
  {
    label: "Fire Code Construction Tax",
    code: "628-BFP-01",
    cols: [{ key: "constructiontaxamount", label: "Amount" }],
  },
  {
    label: "Fire Code Realty Tax",
    code: "628-BFP-02",
    cols: [{ key: "realtytaxamount", label: "Amount" }],
  },
  {
    label: "Fire Code Premium Tax",
    code: "628-BFP-03",
    cols: [{ key: "premiumtaxamount", label: "Amount" }],
  },
  {
    label: "Fire Code Sales Tax",
    code: "628-BFP-04",
    cols: [{ key: "salestaxamount", label: "Amount" }],
  },
  {
    label: "Fire Code Proceeds Tax",
    code: "628-BFP-05",
    cols: [{ key: "proceedstaxamount", label: "Amount" }],
  },
  {
    label: "Fire Safety Inspection Fee",
    code: "628-BFP-06",
    cols: [
      { key: "fsifoccupancyamount", label: "Occupancy" },
      { key: "fsifbusinessamount", label: "Business" },
    ],
  },
  {
    label: "Storage Clearance Fee",
    code: "628-BFP-07",
    cols: [{ key: "storageclearanceamount", label: "Amount" }],
  },
  {
    label: "Conveyance Clearance Fee",
    code: "628-BFP-08",
    cols: [{ key: "conveyanceclearanceamount", label: "Amount" }],
  },
  {
    label: "Installation Clearance Fee",
    code: "628-BFP-09",
    cols: [
      { key: "installbseamount", label: "Building Service Equipment" },
      { key: "installafssamount", label: "AFSS" },
      { key: "installfdasamount", label: "FDAS" },
      { key: "installkhssamount", label: "KHSS" },
      { key: "installtankamount", label: "Flammable & Combustible Liquids Storage Tanks" },
      { key: "installlpgasamount", label: "LPGAS System" },
      { key: "installotheramount", label: "Other Installation Clearance" },
    ],
  },
  {
    label: "Fire Code Administrative Fines",
    code: "628-BFP-10",
    cols: [{ key: "adminfinesamount", label: "Amount" }],
  },
  {
    label: "Other Fees",
    code: "628-BFP-11-a",
    cols: [
      { key: "feefireworksamount", label: "Fireworks Display" },
      { key: "feeelectricalamount", label: "Electrical Installation" },
      { key: "feefilingfsecamount", label: "Filing Fees for FSEC" },
      { key: "feecertifiedcopyamount", label: "Certified True Copy" },
      { key: "feefumigationamount", label: "Fumigation / Fogging" },
      { key: "feefireincidentamount", label: "Fire Incident Clearance" },
      { key: "feeprotestamount", label: "Protest Fee" },
      { key: "feefiredrillamount", label: "Fire Drill" },
      { key: "feeappealamount", label: "Appeal Fee" },
      { key: "feeopenflameamount", label: "Open Flame" },
      { key: "feeseminaramount", label: "Fire Prevention & Safety Seminar" },
      { key: "feesoundstageamount", label: "Soundstage & Production Facilities" },
      { key: "feeweldingamount", label: "Welding, Cutting & Hotworks" },
      { key: "feeotheramount", label: "Other Fees" },
    ],
  },
  {
    label: "Certificate of Competency (COC) Fees",
    code: "628-BFP-11-b",
    cols: [{ key: "cocfeesamount", label: "Amount" }],
  },
];

/** Flat list of every amount key, in report order. */
export const FEE_KEYS: string[] = FEE_GROUPS.flatMap((g) => g.cols.map((c) => c.key));

/** The four establishment sectors of the report, in printed order. */
export const FEE_SECTORS: { key: FireCodeSectorKey; code: number; label: string; title: string }[] =
  [
    { key: "bplo", code: 1, label: "BPLO", title: "BPLO (Business Establishments)" },
    { key: "gov", code: 2, label: "GOV", title: "GOV (Government Buildings)" },
    { key: "peza", code: 3, label: "PEZA", title: "PEZA (PEZA Establishments)" },
    { key: "tieza", code: 4, label: "TIEZA", title: "TIEZA (Other Economic Zones)" },
  ];

/** Peso display used by every amount cell. */
export const peso = (value: number) =>
  (Number(value) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
