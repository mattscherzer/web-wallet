import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDate, getDateGroupLabel, groupByDate, toISODateString } from './dateHelpers';

describe('toISODateString', () => {
  it('formats a local date as YYYY-MM-DD with zero padding', () => {
    expect(toISODateString(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toISODateString(new Date(2026, 11, 31, 23, 59, 59))).toBe('2026-12-31');
  });
});

describe('formatDate', () => {
  it('renders a long US-style date without shifting the day', () => {
    expect(formatDate('2026-01-05')).toBe('January 5, 2026');
    expect(formatDate('2026-12-31')).toBe('December 31, 2026');
  });
});

describe('getDateGroupLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('labels today and yesterday', () => {
    vi.setSystemTime(new Date(2026, 2, 10, 12, 0));
    expect(getDateGroupLabel('2026-03-10')).toBe('TODAY');
    expect(getDateGroupLabel('2026-03-09')).toBe('YESTERDAY');
  });

  it('uses the weekday and short date for anything older', () => {
    vi.setSystemTime(new Date(2026, 2, 10, 12, 0));
    expect(getDateGroupLabel('2026-03-08')).toBe('SUNDAY, MAR 8');
  });

  it('does not treat a future date as today', () => {
    vi.setSystemTime(new Date(2026, 2, 10, 12, 0));
    expect(getDateGroupLabel('2026-03-11')).toBe('WEDNESDAY, MAR 11');
  });

  it('rolls over at local midnight', () => {
    vi.setSystemTime(new Date(2026, 2, 10, 0, 0, 1));
    expect(getDateGroupLabel('2026-03-10')).toBe('TODAY');
    expect(getDateGroupLabel('2026-03-09')).toBe('YESTERDAY');

    vi.setSystemTime(new Date(2026, 2, 9, 23, 59, 59));
    expect(getDateGroupLabel('2026-03-10')).toBe('TUESDAY, MAR 10');
    expect(getDateGroupLabel('2026-03-09')).toBe('TODAY');
  });

  it('finds yesterday across month and year boundaries', () => {
    vi.setSystemTime(new Date(2026, 2, 1, 9, 0));
    expect(getDateGroupLabel('2026-02-28')).toBe('YESTERDAY');

    vi.setSystemTime(new Date(2026, 0, 1, 9, 0));
    expect(getDateGroupLabel('2025-12-31')).toBe('YESTERDAY');
  });
});

describe('groupByDate', () => {
  it('groups items by exact date string, preserving input order', () => {
    const items = [
      { id: 'a', date: '2026-03-10' },
      { id: 'b', date: '2026-03-09' },
      { id: 'c', date: '2026-03-10' },
      { id: 'd', date: '2026-02-28' },
    ];

    const groups = groupByDate(items);

    expect([...groups.keys()]).toEqual(['2026-03-10', '2026-03-09', '2026-02-28']);
    expect(groups.get('2026-03-10')?.map((i) => i.id)).toEqual(['a', 'c']);
    expect(groups.get('2026-03-09')?.map((i) => i.id)).toEqual(['b']);
  });

  it('returns an empty map for no items', () => {
    expect(groupByDate([]).size).toBe(0);
  });
});
