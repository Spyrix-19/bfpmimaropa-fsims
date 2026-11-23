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

export type StationPerformanceSortDirection = 'asc' | 'desc';

function metricValue(row: DashboardStationSummaryComplianceModel, key: StationPerformanceSortKey) {
  switch (key) {
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
}

const byName = (a: DashboardStationSummaryComplianceModel, b: DashboardStationSummaryComplianceModel) =>
  (a.stationname ?? '').localeCompare(b.stationname ?? '') ||
  (a.stationno ?? '').localeCompare(b.stationno ?? '');

/**
 * Sorts stations by a column. Ties always fall back to station name A–Z so
 * the order is stable whichever direction is picked.
 */
export function sortStationPerformanceRows(
  rows: DashboardStationSummaryComplianceModel[],
  sortKey: StationPerformanceSortKey | 'station' = 'totalAccomplished',
  direction: StationPerformanceSortDirection = 'desc',
): DashboardStationSummaryComplianceModel[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sortKey === 'station') return sign * byName(a, b);
    const diff = metricValue(a, sortKey) - metricValue(b, sortKey);
    if (diff !== 0) return sign * diff;
    return byName(a, b);
  });
}

/**
 * met    – accomplished reached the target (or something was done with no target)
 * below  – accomplished is under the target
 * none   – no target and nothing accomplished
 */
export type StationTargetStatus = 'met' | 'below' | 'none';
export type StationTargetStatusFilter = 'all' | StationTargetStatus;

export function getStationTargetStatus(row: DashboardStationSummaryComplianceModel): StationTargetStatus {
  const target = getStationTotalTarget(row);
  const accomplished = getStationTotalAccomplished(row);
  if (target === 0 && accomplished === 0) return 'none';
  return accomplished >= target ? 'met' : 'below';
}

export function filterStationPerformanceRows(
  rows: DashboardStationSummaryComplianceModel[],
  status: StationTargetStatusFilter,
): DashboardStationSummaryComplianceModel[] {
  if (status === 'all') return rows;
  return rows.filter((row) => getStationTargetStatus(row) === status);
}

export interface StationPerformanceSummary {
  target: number;
  accomplished: number;
  remaining: number;
  positiveListing: number;
  /** Overall accomplished ÷ target; null when there is no target. */
  percentage: number | null;
  met: number;
  below: number;
  none: number;
}

export function summarizeStationPerformanceRows(
  rows: DashboardStationSummaryComplianceModel[],
): StationPerformanceSummary {
  const summary: StationPerformanceSummary = {
    target: 0,
    accomplished: 0,
    remaining: 0,
    positiveListing: 0,
    percentage: null,
    met: 0,
    below: 0,
    none: 0,
  };
  rows.forEach((row) => {
    summary.target += getStationTotalTarget(row);
    summary.accomplished += getStationTotalAccomplished(row);
    summary.remaining += getStationRemaining(row);
    summary.positiveListing += getStationPositiveListing(row);
    summary[getStationTargetStatus(row)] += 1;
  });
  summary.percentage = summary.target > 0 ? (summary.accomplished / summary.target) * 100 : null;
  return summary;
}
