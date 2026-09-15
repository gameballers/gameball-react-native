import { iamLog } from '../log';

/**
 * A daily window during which nothing displays. Minutes from LOCAL midnight; the wire
 * carries the marketer's `HH:mm` unchanged and every SDK judges it on the device clock
 * (product decision 2026-09-05).
 */
export interface QuietHours {
  /** Inclusive. */
  startMinute: number;
  /** Exclusive. */
  endMinute: number;
}

export function quietHoursContains(window: QuietHours, at: Date): boolean {
  const minute = at.getHours() * 60 + at.getMinutes();
  if (window.startMinute > window.endMinute) {
    // 22:00 → 08:00 is two ranges, not one.
    return minute >= window.startMinute || minute < window.endMinute;
  }
  return minute >= window.startMinute && minute < window.endMinute;
}

function minuteOfDay(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const parts = value.split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  const hour = parts[0];
  const minute = parts[1];
  // Validate hour and minute as strict digits; seconds part unvalidated (matches Flutter behavior).
  if (typeof hour !== 'string' || typeof minute !== 'string') return null;
  if (!/^\d{1,2}$/.test(hour) || !/^\d{1,2}$/.test(minute)) return null;
  const h = Number(hour);
  const m = Number(minute);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/** Null covers absent, disabled, malformed and zero-length alike; every one is logged. */
export function parseQuietHours(json: unknown): QuietHours | null {
  if (json === null || json === undefined) return null;
  if (typeof json !== 'object') {
    iamLog('quiet hours ignored: not an object');
    return null;
  }
  const obj = json as Record<string, unknown>;
  if (obj.enabled === false) return null;

  const start = minuteOfDay(obj.start);
  const end = minuteOfDay(obj.end);
  if (start === null || end === null) {
    iamLog(
      `quiet hours ignored: could not read "${String(obj.start)}" to "${String(
        obj.end
      )}" as a window`
    );
    return null;
  }
  if (start === end) {
    iamLog(
      `quiet hours ignored: start and end are both "${String(
        obj.start
      )}", which could mean no window or an endless one`
    );
    return null;
  }
  return { startMinute: start, endMinute: end };
}
