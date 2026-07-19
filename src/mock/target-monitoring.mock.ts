export interface TargetRow {
  id: string;
  province: string;
  city: string;
  january_bplo: number;
  january_govt: number;
  january_peza: number;
  january_tieza: number;
  february_bplo: number;
  february_govt: number;
  february_peza: number;
  february_tieza: number;
  march_bplo: number;
  march_govt: number;
  march_peza: number;
  march_tieza: number;
}

export const targetRows: TargetRow[] = [
  {
    id: "1",
    province: "Occidental Mindoro",
    city: "Abra De Ilog",
    january_bplo: 23,
    january_govt: 0,
    january_peza: 0,
    january_tieza: 0,
    february_bplo: 52,
    february_govt: 12,
    february_peza: 0,
    february_tieza: 0,
    march_bplo: 12,
    march_govt: 9,
    march_peza: 0,
    march_tieza: 0,
  },
  {
    id: "2",
    province: "Occidental Mindoro",
    city: "Calintaan",
    january_bplo: 47,
    january_govt: 7,
    january_peza: 0,
    january_tieza: 0,
    february_bplo: 95,
    february_govt: 20,
    february_peza: 0,
    february_tieza: 0,
    march_bplo: 13,
    march_govt: 24,
    march_peza: 0,
    march_tieza: 0,
  },
  {
    id: "3",
    province: "Occidental Mindoro",
    city: "Looc",
    january_bplo: 23,
    january_govt: 0,
    january_peza: 0,
    january_tieza: 0,
    february_bplo: 43,
    february_govt: 5,
    february_peza: 0,
    february_tieza: 0,
    march_bplo: 35,
    march_govt: 6,
    march_peza: 0,
    march_tieza: 0,
  },
  {
    id: "4",
    province: "Occidental Mindoro",
    city: "Lubang",
    january_bplo: 17,
    january_govt: 0,
    january_peza: 0,
    january_tieza: 0,
    february_bplo: 47,
    february_govt: 10,
    february_peza: 0,
    february_tieza: 0,
    march_bplo: 72,
    march_govt: 10,
    march_peza: 0,
    march_tieza: 0,
  },
  {
    id: "5",
    province: "Occidental Mindoro",
    city: "San Jose",
    january_bplo: 847,
    january_govt: 0,
    january_peza: 0,
    january_tieza: 0,
    february_bplo: 1195,
    february_govt: 32,
    february_peza: 0,
    february_tieza: 0,
    march_bplo: 203,
    march_govt: 133,
    march_peza: 0,
    march_tieza: 0,
  },
];

export const targetMonitoringMock = {
  rows: targetRows,
};

export default targetMonitoringMock;
