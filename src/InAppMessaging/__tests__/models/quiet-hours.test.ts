import { parseQuietHours, quietHoursContains } from '../../models/quiet-hours';

/** A local Date at HH:mm today. */
const local = (h: number, m: number) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};

describe('parseQuietHours', () => {
  it('reads a window and treats the end as exclusive', () => {
    const q = parseQuietHours({ enabled: true, start: '22:00', end: '08:00' });
    expect(q).toEqual({ startMinute: 22 * 60, endMinute: 8 * 60 });
  });
  it('returns null for absent, disabled, malformed, zero-length', () => {
    expect(parseQuietHours(null)).toBeNull();
    expect(parseQuietHours(undefined)).toBeNull();
    expect(
      parseQuietHours({ enabled: false, start: '22:00', end: '08:00' })
    ).toBeNull();
    expect(parseQuietHours({ start: '25:00', end: '08:00' })).toBeNull();
    expect(parseQuietHours({ start: '22:00', end: '22:00' })).toBeNull();
    expect(parseQuietHours('22:00-08:00')).toBeNull();
    expect(parseQuietHours({ start: '10:', end: '11:00' })).toBeNull();
    expect(parseQuietHours({ start: '0x10:00', end: '11:00' })).toBeNull();
  });
  it('accepts HH:mm:ss', () => {
    expect(parseQuietHours({ start: '09:30:00', end: '10:30:00' })).toEqual({
      startMinute: 570,
      endMinute: 630,
    });
  });
});

describe('quietHoursContains (local clock)', () => {
  const overnight = { startMinute: 22 * 60, endMinute: 8 * 60 };
  const daytime = { startMinute: 9 * 60 + 30, endMinute: 10 * 60 + 30 };

  it('wraps past midnight', () => {
    expect(quietHoursContains(overnight, local(23, 0))).toBe(true);
    expect(quietHoursContains(overnight, local(3, 0))).toBe(true);
    expect(quietHoursContains(overnight, local(12, 0))).toBe(false);
  });
  it('start inclusive, end exclusive', () => {
    expect(quietHoursContains(daytime, local(9, 30))).toBe(true);
    expect(quietHoursContains(daytime, local(10, 30))).toBe(false);
    expect(quietHoursContains(daytime, local(10, 29))).toBe(true);
  });
});
