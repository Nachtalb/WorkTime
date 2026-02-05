import {
  format,
  isToday,
  isYesterday,
  isSameWeek,
  differenceInDays,
  startOfDay,
  endOfDay,
  startOfWeek,
  isWithinInterval,
  subWeeks,
  addDays,
  subDays,
  parseISO,
} from 'date-fns';

export function formatTime(timestamp: number): string {
  return format(new Date(timestamp), 'HH:mm');
}

export function formatDate(timestamp: number): string {
  return format(new Date(timestamp), 'yyyy-MM-dd');
}

export function formatDateFull(timestamp: number): string {
  return format(new Date(timestamp), 'MMMM d, yyyy');
}

export function formatDateShort(timestamp: number): string {
  return format(new Date(timestamp), 'MMM d');
}

export function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  } else {
    return `${seconds}s`;
  }
}

export function formatDurationShort(ms: number): string {
  if (ms < 0) ms = 0;

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

export function getRelativeDate(timestamp: number): string {
  const date = new Date(timestamp);

  if (isToday(date)) {
    return 'Today';
  }

  if (isYesterday(date)) {
    return 'Yesterday';
  }

  const daysDiff = differenceInDays(new Date(), date);

  if (daysDiff < 7) {
    return format(date, 'EEEE'); // Monday, Tuesday, etc.
  }

  // Check if it was last week
  const lastWeekStart = startOfWeek(subWeeks(new Date(), 1));
  const lastWeekEnd = endOfDay(subWeeks(startOfWeek(new Date()), 1));

  if (
    isWithinInterval(date, {
      start: lastWeekStart,
      end: lastWeekEnd,
    })
  ) {
    return `Last ${format(date, 'EEEE')}`;
  }

  return format(date, 'MMM d, yyyy');
}

export function getTooltipDate(timestamp: number): string {
  return format(new Date(timestamp), 'EEEE, MMMM d, yyyy');
}

export function getTodayDateString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function isTimestampToday(timestamp: number): boolean {
  return isToday(new Date(timestamp));
}

export function getStartOfDay(timestamp: number): number {
  return startOfDay(new Date(timestamp)).getTime();
}

export function getEndOfDay(timestamp: number): number {
  return endOfDay(new Date(timestamp)).getTime();
}

export function groupByDay<T extends { startTime: number }>(
  items: T[]
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const item of items) {
    const dateKey = formatDate(item.startTime);
    const existing = grouped.get(dateKey) || [];
    existing.push(item);
    grouped.set(dateKey, existing);
  }

  return grouped;
}

export function getCurrentTime(): string {
  return format(new Date(), 'HH:mm:ss');
}

export function getCurrentDate(): string {
  return format(new Date(), 'EEEE, MMMM d, yyyy');
}

export function getOverviewTitle(dateString: string): string {
  const date = parseISO(dateString);

  if (isToday(date)) {
    return "Today's Overview";
  }

  if (isYesterday(date)) {
    return "Yesterday's Overview";
  }

  // Check if in same week as today
  if (isSameWeek(date, new Date(), { weekStartsOn: 1 })) {
    return `${format(date, 'EEEE')}'s Overview`;
  }

  // Otherwise use DD.MM.YYYY format
  return `${format(date, 'dd.MM.yyyy')}'s Overview`;
}

export function getDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function getNextDay(dateString: string): string {
  return getDateString(addDays(parseISO(dateString), 1));
}

export function getPreviousDay(dateString: string): string {
  return getDateString(subDays(parseISO(dateString), 1));
}

export function isDateInFuture(dateString: string): boolean {
  return parseISO(dateString) > new Date();
}

export function formatDateForPicker(dateString: string): string {
  return dateString; // Already in yyyy-MM-dd format
}

export function formatDateDisplay(dateString: string): string {
  return format(parseISO(dateString), 'dd.MM.yyyy');
}
