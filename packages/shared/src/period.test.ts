// Chuyển từ HTKH-KPI/app/tests/period.test.js (dòng 9-63, 144-203); giá trị mong đợi giữ nguyên.
import { describe, expect, it } from 'vitest';
import { isoDate } from './date';
import {
  monthPeriod,
  previousPeriod,
  quarterPeriod,
  reportPeriods,
  runningMonthPeriod,
  trendPeriods,
  weekPeriod,
} from './period';

const p = (start: string, end: string) => ({ start, end });
const d = isoDate;

describe('period', () => {
  it('tuần = thứ Sáu tuần trước .. thứ Năm tuần này', () => {
    expect(weekPeriod(d('2026-10-28'))).toEqual(p('2026-10-23', '2026-10-29'));
    expect(weekPeriod(d('2026-10-29'))).toEqual(p('2026-10-23', '2026-10-29')); // thứ Năm là ngày cuối tuần
    expect(weekPeriod(d('2026-10-30'))).toEqual(p('2026-10-30', '2026-11-05')); // thứ Sáu mở tuần mới
    expect(weekPeriod(d('2027-01-01'))).toEqual(p('2027-01-01', '2027-01-07')); // qua năm
  });

  it('tháng = 16 tháng trước .. 15 tháng được đặt tên (theo tháng dương lịch)', () => {
    expect(monthPeriod(d('2026-10-28'), 0)).toEqual(p('2026-09-16', '2026-10-15'));
    expect(monthPeriod(d('2026-10-28'), -1)).toEqual(p('2026-08-16', '2026-09-15'));
    expect(monthPeriod(d('2027-01-05'), 0)).toEqual(p('2026-12-16', '2027-01-15'));
    expect(monthPeriod(d('2027-01-05'), -1)).toEqual(p('2026-11-16', '2026-12-15'));
    expect(monthPeriod(d('2027-03-01'), 0)).toEqual(p('2027-02-16', '2027-03-15'));
  });

  it('khoảng mặc định = kỳ tháng đang chạy', () => {
    expect(runningMonthPeriod(d('2026-10-28'))).toEqual(p('2026-10-16', '2026-11-15'));
    expect(runningMonthPeriod(d('2026-10-16'))).toEqual(p('2026-10-16', '2026-11-15'));
    expect(runningMonthPeriod(d('2026-10-15'))).toEqual(p('2026-09-16', '2026-10-15'));
    expect(runningMonthPeriod(d('2026-12-20'))).toEqual(p('2026-12-16', '2027-01-15'));
  });

  it('nút Kỳ này / Kỳ trước: kỳ đang chạy và kỳ ngay trước', () => {
    const prev = (t: string) => monthPeriod(runningMonthPeriod(d(t)).end, -1);
    expect(runningMonthPeriod(d('2026-10-30'))).toEqual(p('2026-10-16', '2026-11-15'));
    expect(prev('2026-10-30')).toEqual(p('2026-09-16', '2026-10-15'));
    expect(runningMonthPeriod(d('2026-11-03'))).toEqual(p('2026-10-16', '2026-11-15'));
    expect(prev('2026-11-03')).toEqual(p('2026-09-16', '2026-10-15'));
    expect(runningMonthPeriod(d('2026-11-16'))).toEqual(p('2026-11-16', '2026-12-15'));
    expect(prev('2026-11-16')).toEqual(p('2026-10-16', '2026-11-15'));
    expect(prev('2027-01-10')).toEqual(p('2026-11-16', '2026-12-15'));
  });

  it('previousPeriod: tháng → tháng trước, khoảng khác → cùng số ngày ngay trước', () => {
    const prev = (a: string, b: string) => previousPeriod({ start: d(a), end: d(b) });
    expect(prev('2026-09-16', '2026-10-15')).toEqual(p('2026-08-16', '2026-09-15'));
    expect(prev('2026-12-16', '2027-01-15')).toEqual(p('2026-11-16', '2026-12-15')); // qua năm
    expect(prev('2027-02-16', '2027-03-15')).toEqual(p('2027-01-16', '2027-02-15')); // kỳ 28 ngày vẫn theo tháng
    expect(prev('2026-10-28', '2026-10-28')).toEqual(p('2026-10-27', '2026-10-27')); // một ngày
    expect(prev('2026-10-23', '2026-10-29')).toEqual(p('2026-10-16', '2026-10-22')); // một tuần
    expect(prev('2026-10-05', '2026-10-14')).toEqual(p('2026-09-25', '2026-10-04')); // 10 ngày
  });

  it('trendPeriods: 12 tuần hoặc 6 tháng, cũ nhất trước, kỳ đang chạy cuối', () => {
    const w = trendPeriods('week', d('2026-10-30'));
    expect(w).toHaveLength(12);
    expect(w[11]).toEqual(p('2026-10-30', '2026-11-05'));
    expect(w[10]).toEqual(p('2026-10-23', '2026-10-29'));
    expect(w[0]?.start).toBe('2026-08-14');
    const m = trendPeriods('month', d('2026-10-30'));
    expect(m).toHaveLength(6);
    expect(m[5]).toEqual(p('2026-10-16', '2026-11-15'));
    expect(m[0]).toEqual(p('2026-05-16', '2026-06-15'));
    expect(trendPeriods('month', d('2027-01-10'))[4]).toEqual(p('2026-11-16', '2026-12-15'));
  });

  it('reportPeriods WR: 12 tuần, mới nhất trước, kỳ đang chạy đầu, có số tuần TS24', () => {
    const w = reportPeriods('WR', d('2026-11-04'));
    expect(w).toHaveLength(12);
    expect(w[0]?.running).toBe(true);
    expect(w[1]?.running).toBe(false);
    expect(w[1]?.label).toBe('Tuần 43 tháng 10/2026');
    expect(w[1]?.start).toBe('2026-10-23');
    expect(w[1]?.end).toBe('2026-10-29');
  });

  it('tuần 1 bắt đầu thứ Sáu đầu tiên của năm; tuần vắt qua năm mới thuộc năm cũ', () => {
    expect(reportPeriods('WR', d('2026-01-08'))[0]?.label).toBe('Tuần 1 tháng 01/2026');
    expect(reportPeriods('WR', d('2026-01-01'))[0]?.label).toBe('Tuần 52 tháng 01/2026');
  });

  it('năm có 01/01 là thứ Sáu: tuần 1 bắt đầu 01/01', () => {
    expect(reportPeriods('WR', d('2027-01-01'))[0]?.label).toBe('Tuần 1 tháng 01/2027');
  });

  it('reportPeriods MR: 6 kỳ tháng, đặt tên theo tháng kết thúc', () => {
    const m = reportPeriods('MR', d('2026-11-04'));
    expect(m).toHaveLength(6);
    expect(m[0]?.label).toBe('Tháng 11/2026');
    expect(m[1]?.label).toBe('Tháng 10/2026');
    expect(m[1]?.start).toBe('2026-09-16');
    expect(m[1]?.end).toBe('2026-10-15');
  });

  it('reportPeriods QR: 6 quý cố định, Quý 4 = 16/09 .. 15/12', () => {
    const q = reportPeriods('QR', d('2026-11-04'));
    expect(q).toHaveLength(6);
    expect(q[0]?.label).toBe('Qúy 04/2026');
    expect(q[0]?.running).toBe(true);
    expect(q[0]?.start).toBe('2026-09-16');
    expect(q[0]?.end).toBe('2026-12-15');
    expect(q[1]?.label).toBe('Qúy 03/2026');
    expect(q[1]?.start).toBe('2026-06-16');
    expect(q[1]?.end).toBe('2026-09-15');
  });

  it('quarterPeriod: Quý 1 vắt qua năm mới, lấy năm của ngày cuối', () => {
    const q1 = reportPeriods('QR', d('2026-12-20'))[0];
    expect(q1?.label).toBe('Qúy 01/2027');
    expect(q1?.start).toBe('2026-12-16');
    expect(q1?.end).toBe('2027-03-15');
    expect(quarterPeriod(d('2026-12-15'), 0).end).toBe('2026-12-15');
    expect(quarterPeriod(d('2026-03-15'), -1).end).toBe('2025-12-15');
  });

  it('16/12 thuộc Quý 1 năm sau, 15/12 còn Quý 4', () => {
    expect(quarterPeriod(d('2026-12-16'))).toEqual(p('2026-12-16', '2027-03-15'));
    expect(quarterPeriod(d('2026-12-15'))).toEqual(p('2026-09-16', '2026-12-15'));
  });
});
