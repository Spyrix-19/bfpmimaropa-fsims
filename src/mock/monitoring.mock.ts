/**
 * Centralized sample/mock data for the Semester Monitoring page.
 *
 * These rows are for UI representation only. Monitoring filters do NOT
 * affect any of these numbers — they will be wired up once the backend
 * exposes a real aggregation endpoint.
 */

export interface MonitoringRow {
  city: string;
  target: number;
  actual: number;
  manual: number;
  fsis: number;
  ntcNod: number;
  ntcv: number;
  closure: number;
}

export const monitoringRows: MonitoringRow[] = [
  { city: "Puerto Princesa City", target: 420, actual: 388, manual: 210, fsis: 178, ntcNod: 24, ntcv: 12, closure: 4 },
  { city: "Calapan City", target: 360, actual: 331, manual: 180, fsis: 151, ntcNod: 19, ntcv: 8, closure: 2 },
  { city: "Boac", target: 180, actual: 168, manual: 95, fsis: 73, ntcNod: 9, ntcv: 5, closure: 1 },
  { city: "Odiongan", target: 210, actual: 194, manual: 110, fsis: 84, ntcNod: 12, ntcv: 6, closure: 2 },
  { city: "San Jose (Occ. Mindoro)", target: 240, actual: 221, manual: 128, fsis: 93, ntcNod: 14, ntcv: 7, closure: 3 },
  { city: "Coron", target: 150, actual: 138, manual: 78, fsis: 60, ntcNod: 8, ntcv: 4, closure: 1 },
  { city: "Romblon", target: 130, actual: 119, manual: 70, fsis: 49, ntcNod: 7, ntcv: 3, closure: 1 },
  { city: "Mamburao", target: 140, actual: 128, manual: 74, fsis: 54, ntcNod: 8, ntcv: 4, closure: 1 },
];

export const monitoringMockData = {
  rows: monitoringRows,
};

export default monitoringMockData;
