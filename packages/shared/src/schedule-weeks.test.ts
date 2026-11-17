// Chuyển từ HTKH-KPI/app/tests/schedule.test.js (dòng 8-12); giá trị mong đợi giữ nguyên.
import { expect, it } from 'vitest';
import { isoDate } from './date';
import { scheduleMonthOf, scheduleMonthShift, scheduleWeeks } from './schedule-weeks';

it('tuần lịch thuộc tháng của thứ Sáu', () => {
  expect(scheduleWeeks('2026-11')).toEqual(['2026-11-06', '2026-11-13', '2026-11-20', '2026-11-27']);
  expect(scheduleWeeks('2027-01')).toHaveLength(5);
  expect(scheduleMonthOf(isoDate('2026-11-30'))).toBe('2026-12'); // thứ Hai của tuần 04/12
  expect(scheduleMonthOf(isoDate('2026-11-29'))).toBe('2026-11'); // Chủ nhật đi với tuần vừa hết
  expect(scheduleMonthShift('2026-12', 1)).toBe('2027-01');
});
