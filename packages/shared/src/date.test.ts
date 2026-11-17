import { describe, expect, it, vi } from 'vitest';
import { addDays, dayOfWeek, daysBetween, isIsoDate, isoDate, makeDate, parts, toVnDate } from './date';

describe('date', () => {
  it('isoDate nhận ngày có thật, chặn ngày sai', () => {
    expect(isoDate('2028-02-29')).toBe('2028-02-29');
    for (const s of ['2027-02-29', '2026-02-30', '2026-2-03', '2026-13-01', '', '2026-11-17T00:00']) {
      expect(isIsoDate(s)).toBe(false);
      expect(() => isoDate(s)).toThrow(RangeError);
    }
  });

  it('addDays qua tháng, năm, năm nhuận', () => {
    expect(addDays(isoDate('2028-02-28'), 1)).toBe('2028-02-29');
    expect(addDays(isoDate('2027-02-28'), 1)).toBe('2027-03-01');
    expect(addDays(isoDate('2026-12-31'), 1)).toBe('2027-01-01');
    expect(addDays(isoDate('2027-01-01'), -1)).toBe('2026-12-31');
  });

  it('makeDate cho phép tràn tháng', () => {
    expect(makeDate(2027, 0, 16)).toBe('2026-12-16');
    expect(makeDate(2026, 13, 15)).toBe('2027-01-15');
    expect(makeDate(2027, -1, 16)).toBe('2026-11-16');
  });

  it('dayOfWeek, daysBetween và parts', () => {
    expect(dayOfWeek(isoDate('2026-10-30'))).toBe(5); // thứ Sáu
    expect(dayOfWeek(isoDate('2026-11-01'))).toBe(0); // Chủ nhật
    expect(daysBetween(isoDate('2026-10-23'), isoDate('2026-10-29'))).toBe(6);
    expect(parts(isoDate('2026-02-05'))).toEqual({ year: 2026, month: 2, day: 5 });
  });

  it('toVnDate theo Asia/Ho_Chi_Minh ở mốc nửa đêm', () => {
    expect(toVnDate(new Date('2026-11-15T16:59:59Z'))).toBe('2026-11-15');
    expect(toVnDate(new Date('2026-11-15T17:00:00Z'))).toBe('2026-11-16');
    expect(toVnDate(new Date('2026-12-31T17:30:00Z'))).toBe('2027-01-01');
  });

  it('toVnDate không phụ thuộc chuỗi định dạng của locale', () => {
    // ICU từng đổi định dạng ngắn của en-CA; chỉ được dựa vào từng phần year/month/day.
    // `format` là getter trả về hàm; kiểu lib khai báo như method nên ép kiểu để spy getter.
    const proto = Intl.DateTimeFormat.prototype as unknown as { format: unknown };
    const spy = vi.spyOn(proto, 'format', 'get').mockReturnValue(() => '11/16/2026');
    try {
      expect(toVnDate(new Date('2026-11-15T17:00:00Z'))).toBe('2026-11-16');
    } finally {
      spy.mockRestore();
    }
  });
});
