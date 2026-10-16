/**
 * Calendar dates for filters and posting dates.
 * `toISOString()` is UTC and shifts the day in timezones ahead of UTC (e.g. Uganda UTC+3).
 * Date-only strings (`YYYY-MM-DD`) must not be passed to `new Date(...)` — JS parses those as UTC.
 */

export function formatDateYmdLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayYmdLocal(): string {
  return formatDateYmdLocal(new Date());
}

/** Local clock on a chosen calendar day, without a UTC shift. */
export function localDateTimeForYmd(ymd: string): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${ymd}T${hh}:${mm}:${ss}`;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;

/** Parse YYYY-MM-DD as a local calendar day (midnight local, not UTC). */
export function parseLocalISODate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }
  const match = String(value).trim().match(DATE_ONLY);
  if (!match) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  return new Date(year, month, day);
}

/** Keep a date-only string as-is; never parse YYYY-MM-DD via `new Date()` (UTC shift). */
export function toDateOnly(value?: string | Date | null): string {
  if (value == null || value === '') {
    return '';
  }
  if (typeof value === 'string') {
    const match = value.trim().match(DATE_ONLY);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return formatDateYmdLocal(date);
}

export function formatDateOnlyDisplay(value?: string | null): string {
  const date = parseLocalISODate(toDateOnly(value) || value);
  if (!date) {
    return value || '';
  }
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export type ExpenseDateFilter =
  | 'today'
  | 'yesterday'
  | 'thismonth'
  | 'last7days'
  | 'last30days'
  | 'last3months'
  | 'alltime'
  | 'custom';

export function localDateRangeForFilter(filter: ExpenseDateFilter): {
  startDate: string | null;
  endDate: string | null;
} {
  if (filter === 'alltime' || filter === 'custom') {
    return {startDate: null, endDate: null};
  }

  const today = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    new Date().getDate(),
  );

  if (filter === 'yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return {
      startDate: formatDateYmdLocal(yesterday),
      endDate: formatDateYmdLocal(yesterday),
    };
  }

  const start = new Date(today);

  if (filter === 'thismonth') {
    start.setDate(1);
  } else if (filter === 'last7days') {
    start.setDate(today.getDate() - 6);
  } else if (filter === 'last30days') {
    start.setDate(today.getDate() - 29);
  } else if (filter === 'last3months') {
    start.setMonth(today.getMonth() - 3);
  }

  return {
    startDate: formatDateYmdLocal(start),
    endDate: formatDateYmdLocal(today),
  };
}
