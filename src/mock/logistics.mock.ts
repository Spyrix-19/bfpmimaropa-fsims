/**
 * Centralized mock data for the Logistics module (Issued BWC + Fire Safety
 * Inspector capability). Replace these arrays with API calls once the
 * endpoints are available — keep the shapes identical so the UI is unchanged.
 */

export interface StationInfo {
  stationno: string;
  stationname: string;
  provincename: string;
  cityname: string;
}

export interface IssuedBwcRow extends StationInfo {
  working: number;
  ber: number;
}

export interface InspectorRow extends StationInfo {
  withTraining: number;
  withoutTraining: number;
}

export const MOCK_ISSUED_BWC: IssuedBwcRow[] = [
  { stationno: "1", stationname: "Calapan City Fire Station", provincename: "Oriental Mindoro", cityname: "Calapan City", working: 14, ber: 3 },
  { stationno: "2", stationname: "Puerto Princesa City Fire Station", provincename: "Palawan", cityname: "Puerto Princesa City", working: 21, ber: 5 },
  { stationno: "3", stationname: "Boac Fire Station", provincename: "Marinduque", cityname: "Boac", working: 8, ber: 1 },
  { stationno: "4", stationname: "San Jose Fire Station", provincename: "Occidental Mindoro", cityname: "San Jose", working: 11, ber: 4 },
  { stationno: "5", stationname: "Odiongan Fire Station", provincename: "Romblon", cityname: "Odiongan", working: 6, ber: 2 },
  { stationno: "6", stationname: "Roxas Fire Station", provincename: "Oriental Mindoro", cityname: "Roxas", working: 9, ber: 0 },
];

export const MOCK_FIRE_SAFETY_INSPECTORS: InspectorRow[] = [
  { stationno: "1", stationname: "Calapan City Fire Station", provincename: "Oriental Mindoro", cityname: "Calapan City", withTraining: 10, withoutTraining: 4 },
  { stationno: "2", stationname: "Puerto Princesa City Fire Station", provincename: "Palawan", cityname: "Puerto Princesa City", withTraining: 16, withoutTraining: 6 },
  { stationno: "3", stationname: "Boac Fire Station", provincename: "Marinduque", cityname: "Boac", withTraining: 5, withoutTraining: 3 },
  { stationno: "4", stationname: "San Jose Fire Station", provincename: "Occidental Mindoro", cityname: "San Jose", withTraining: 7, withoutTraining: 5 },
  { stationno: "5", stationname: "Odiongan Fire Station", provincename: "Romblon", cityname: "Odiongan", withTraining: 4, withoutTraining: 2 },
  { stationno: "6", stationname: "Roxas Fire Station", provincename: "Oriental Mindoro", cityname: "Roxas", withTraining: 6, withoutTraining: 1 },
];

export const totalIssued = (row: IssuedBwcRow) => row.working + row.ber;
export const totalInspectors = (row: InspectorRow) =>
  row.withTraining + row.withoutTraining;