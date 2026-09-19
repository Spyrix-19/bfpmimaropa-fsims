export interface DuplicateDataMonitoringModel {
  primarykey?: string;
  stationno?: string;
  stationcode?: string;
  stationname?: string;
  logourl?: string | null;
  provincename?: string;
  recordtype?: string;
  // Backward compatibility for any legacy PascalCase payloads.
  Primarykey?: string;
  Stationno?: string;
  Stationcode?: string;
  Stationname?: string;
  Logourl?: string | null;
  Provincename?: string;
  Recordtype?: string;
}
