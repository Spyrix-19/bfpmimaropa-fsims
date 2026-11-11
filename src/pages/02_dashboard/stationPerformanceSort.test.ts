import { describe, expect, it } from 'vitest';
import { sortStationPerformanceRows } from './stationPerformanceSort';

describe('sortStationPerformanceRows', () => {
  const rows = [
    {
      stationname: 'Alpha',
      stationcode: 'A-1',
      provincename: 'Palawan',
      stationno: '1',
      totaltargetbplo: 100,
      totaltargetgov: 0,
      totaltargetpeza: 0,
      totaltargettieza: 0,
      totalAccomplishmentbplo: 50,
      totalAccomplishmentgov: 0,
      totalAccomplishmentpeza: 0,
      totalAccomplishmenttieza: 0,
    },
    {
      stationname: 'Bravo',
      stationcode: 'B-2',
      provincename: 'Palawan',
      stationno: '2',
      totaltargetbplo: 20,
      totaltargetgov: 0,
      totaltargetpeza: 0,
      totaltargettieza: 0,
      totalAccomplishmentbplo: 15,
      totalAccomplishmentgov: 0,
      totalAccomplishmentpeza: 0,
      totalAccomplishmenttieza: 0,
    },
    {
      stationname: 'Charlie',
      stationcode: 'C-3',
      provincename: 'Palawan',
      stationno: '3',
      totaltargetbplo: 40,
      totaltargetgov: 0,
      totaltargetpeza: 0,
      totaltargettieza: 0,
      totalAccomplishmentbplo: 25,
      totalAccomplishmentgov: 0,
      totalAccomplishmentpeza: 0,
      totalAccomplishmenttieza: 0,
    },
  ] as any;

  it('defaults to total accomplished descending', () => {
    expect(sortStationPerformanceRows(rows).map((row) => row.stationname)).toEqual([
      'Alpha',
      'Charlie',
      'Bravo',
    ]);
  });

  it('sorts the selected metric with higher values first', () => {
    expect(sortStationPerformanceRows(rows, 'totalTarget').map((row) => row.stationname)).toEqual([
      'Alpha',
      'Charlie',
      'Bravo',
    ]);

    expect(sortStationPerformanceRows(rows, 'positiveListing').map((row) => row.stationname)).toEqual([
      'Alpha',
      'Bravo',
      'Charlie',
    ]);

    expect(sortStationPerformanceRows(rows, 'remaining').map((row) => row.stationname)).toEqual([
      'Alpha',
      'Charlie',
      'Bravo',
    ]);

    expect(sortStationPerformanceRows(rows, 'percentage').map((row) => row.stationname)).toEqual([
      'Bravo',
      'Charlie',
      'Alpha',
    ]);
  });
});
