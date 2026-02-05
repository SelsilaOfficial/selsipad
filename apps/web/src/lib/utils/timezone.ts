/**
 * Timezone utilities for Fairlaunch
 * Standardizes all time handling to UTC+7 (WIB - Indonesia)
 */

/**
 * Convert Date to UTC+7 datetime-local string
 * @param date Date object or ISO string
 * @returns datetime-local compatible string in UTC+7
 */
export function toUTC7DateTimeLocal(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  // Get UTC time and add 7 hours
  const utc7 = new Date(d.getTime() + 7 * 60 * 60 * 1000);

  // Format as YYYY-MM-DDTHH:mm (datetime-local format)
  const year = utc7.getUTCFullYear();
  const month = String(utc7.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utc7.getUTCDate()).padStart(2, '0');
  const hours = String(utc7.getUTCHours()).padStart(2, '0');
  const minutes = String(utc7.getUTCMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Convert datetime-local string (UTC+7) to UTC Date
 * @param dateTimeLocal datetime-local string (assumed to be UTC+7)
 * @returns Date object in UTC
 */
export function fromUTC7DateTimeLocal(dateTimeLocal: string): Date {
  // Parse the datetime-local as if it's UTC+7
  const localDate = new Date(dateTimeLocal);

  // Subtract 7 hours to get UTC
  return new Date(localDate.getTime() - 7 * 60 * 60 * 1000);
}

/**
 * Format Date for display in UTC+7
 * @param date Date object or ISO string
 * @param format 'short' | 'long'
 * @returns formatted string
 */
export function formatUTC7(date: Date | string, format: 'short' | 'long' = 'long'): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  // Convert to UTC+7
  const utc7 = new Date(d.getTime() + 7 * 60 * 60 * 1000);

  const options: Intl.DateTimeFormatOptions =
    format === 'short'
      ? {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'UTC',
          timeZoneName: 'short',
        }
      : {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'UTC',
          timeZoneName: 'short',
        };

  return utc7.toLocaleString('en-US', options) + ' (WIB)';
}

/**
 * Get current time in UTC+7 as datetime-local string
 * @returns current datetime in UTC+7 format
 */
export function nowUTC7DateTimeLocal(): string {
  return toUTC7DateTimeLocal(new Date());
}

/**
 * Convert Unix timestamp to UTC+7 datetime-local
 * @param timestamp Unix timestamp in seconds
 * @returns datetime-local string in UTC+7
 */
export function unixToUTC7DateTimeLocal(timestamp: number): string {
  return toUTC7DateTimeLocal(new Date(timestamp * 1000));
}

/**
 * Convert datetime-local (UTC+7) to Unix timestamp
 * @param dateTimeLocal datetime-local string
 * @returns Unix timestamp in seconds
 */
export function utc7DateTimeLocalToUnix(dateTimeLocal: string): number {
  return Math.floor(fromUTC7DateTimeLocal(dateTimeLocal).getTime() / 1000);
}
