// Tuần lịch (thứ Hai → thứ Bảy): tháng N gồm các tuần có thứ Sáu nằm trong tháng dương lịch N.
// Nguồn: HTKH-KPI/app/src/Pure.js dòng 1190-1206. Không dùng `Date` ở đây (ESLint chặn).
import { type IsoDate, addDays, dayOfWeek, makeDate, parts } from './date';

/** Tháng dạng "YYYY-MM". */
export type YearMonth = string;

const yearMonth = (d: IsoDate): YearMonth => d.slice(0, 7);

/** Các thứ Sáu trong tháng dương lịch `month`. */
export function scheduleWeeks(month: YearMonth): IsoDate[] {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const first = makeDate(y, m, 1);
  const out: IsoDate[] = [];
  for (let d = addDays(first, (5 - dayOfWeek(first) + 7) % 7); parts(d).month === m; d = addDays(d, 7)) out.push(d);
  return out;
}

/** Tuần thứ Hai → Chủ nhật chứa `d` thuộc tháng của thứ Sáu trong tuần đó. */
export const scheduleMonthOf = (d: IsoDate): YearMonth => yearMonth(addDays(d, 4 - ((dayOfWeek(d) + 6) % 7)));

export const scheduleMonthShift = (month: YearMonth, n: number): YearMonth =>
  yearMonth(makeDate(Number(month.slice(0, 4)), Number(month.slice(5, 7)) + n, 1));
