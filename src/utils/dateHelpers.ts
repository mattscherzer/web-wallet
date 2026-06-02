/**
 * Format a date string (YYYY-MM-DD) for display
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Get a relative date label: TODAY, YESTERDAY, or formatted date
 */
export function getDateGroupLabel(dateStr: string): string {
  const today = new Date();
  const todayStr = toISODateString(today);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toISODateString(yesterday);

  if (dateStr === todayStr) return 'TODAY';
  if (dateStr === yesterdayStr) return 'YESTERDAY';

  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).toUpperCase();
}

/**
 * Get today's date as ISO string (YYYY-MM-DD)
 */
export function getTodayString(): string {
  return toISODateString(new Date());
}

/**
 * Convert a Date to YYYY-MM-DD
 */
export function toISODateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Format time from ISO datetime
 */
export function formatTime(isoDatetime: string): string {
  const date = new Date(isoDatetime);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Group transactions by date
 */
export function groupByDate<T extends { date: string }>(
  items: T[]
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const existing = groups.get(item.date);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(item.date, [item]);
    }
  }
  return groups;
}
