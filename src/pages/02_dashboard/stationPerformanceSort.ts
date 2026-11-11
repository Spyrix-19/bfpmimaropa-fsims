import type { DashboardStationSummaryComplianceModel } from '@/types/dashboardType';

export type StationPerformanceSortKey =
  | 'totalTarget'
  | 'totalAccomplished'
  | 'remaining'
  | 'positiveListing'
  | 'percentage';

export function getStationTotalTarget(row: DashboardStationSummaryComplianceModel): number {
  return row.totaltargetbplo + row.totaltargetgov + row.totaltargetpeza + row.totaltargettieza;
}

export function getStationTotalAccomplished(row: DashboardStationSummaryComplianceModel): number {
  return (
    row.totalAccomplishmentbplo +
    row.totalAccomplishmentgov +
    row.totalAccomplishmentpeza +
    row.totalAccomplishmenttieza
  );
}

export function getStationRemaining(row: DashboardStationSummaryComplianceModel): number {
  return Math.max(getStationTotalTarget(row) - getStationTotalAccomplished(row), 0);
}

export function getStationPositiveListing(row: DashboardStationSummaryComplianceModel): number {
  return Math.max(getStationTotalAccomplished(row) - getStationTotalTarget(row), 0);
}

export function getStationPercentage(row: DashboardStationSummaryComplianceModel): number {
  const totalTarget = getStationTotalTarget(row);
  if (totalTarget === 0) return 0;

  return (getStationTotalAccomplished(row) / totalTarget) * 100;
}

export function sortStationPerformanceRows(
  rows: DashboardStationSummaryComplianceModel[],
  sortKey: StationPerformanceSortKey = 'totalAccomplished',
): DashboardStationSummaryComplianceModel[] {
  return [...rows].sort((a, b) => {
    const metricValue = (row: DashboardStationSummaryComplianceModel) => {
      switch (sortKey) {
        case 'totalTarget':
          return getStationTotalTarget(row);
        case 'remaining':
          return getStationRemaining(row);
        case 'positiveListing':
          return getStationPositiveListing(row);
        case 'percentage':
          return getStationPercentage(row);
        case 'totalAccomplished':
        default:
          return getStationTotalAccomplished(row);
      }
    };

    const valueDiff = metricValue(b) - metricValue(a);
    if (valueDiff !== 0) return valueDiff;

    const stationNameDiff = (a.stationname ?? '').localeCompare(b.stationname ?? '');
    if (stationNameDiff !== 0) return stationNameDiff;

    return (a.stationno ?? '').localeCompare(b.stationno ?? '');
  });
}
