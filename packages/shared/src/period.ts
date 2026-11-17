// Kỳ báo cáo TS24. Nguồn: HTKH-KPI/app/src/Pure.js dòng 720-787 và 896-903, giữ đúng thuật toán.
// Không dùng `Date` ở đây (ESLint chặn): mọi phép tính ngày đi qua date.ts.
import { type IsoDate, addDays, dayOfWeek, daysBetween, makeDate, parts } from './date';

/** Kỳ tính cả hai đầu. */
export interface Period {
  start: IsoDate;
  end: IsoDate;
}

export interface ReportPeriod extends Period {
  /** Chữ ô A6 của mẫu xlsx. */
  label: string;
  running: boolean;
}

export type ReportType = 'WR' | 'MR' | 'QR';

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Tuần thứ Sáu → thứ Năm chứa `d`. */
export function weekPeriod(d: IsoDate): Period {
  const start = addDays(d, -((dayOfWeek(d) + 2) % 7)); // số ngày kể từ thứ Sáu gần nhất
  return { start, end: addDays(start, 6) };
}

/** Kỳ tháng mang tên tháng dương lịch của `d` + `offset`: 16 tháng trước .. 15 tháng đó. */
export function monthPeriod(d: IsoDate, offset = 0): Period {
  const { year, month } = parts(d);
  const m = month + offset;
  return { start: makeDate(year, m - 1, 16), end: makeDate(year, m, 15) };
}

/** Kỳ tháng đang chạy vào ngày `d`: từ ngày 16 là kỳ tháng sau. */
export const runningMonthPeriod = (d: IsoDate): Period => monthPeriod(d, parts(d).day >= 16 ? 1 : 0);

/** Quý cố định: Quý 1 = 16/12 năm trước .. 15/03, rồi cứ 3 tháng. `offset` -1 = quý trước. */
export function quarterPeriod(d: IsoDate, offset = 0): Period {
  const { year, month, day } = parts(d);
  let last = month - ((month - 1) % 3) + 2; // tháng 3, 6, 9 hoặc 12
  if (month === last && day > 15) last += 3;
  last += 3 * offset;
  return { start: makeDate(year, last - 3, 16), end: makeDate(year, last, 15) };
}

/** Kỳ so sánh: kỳ tháng 16 → 15 thì về tháng trước; khoảng khác thì cùng số ngày ngay trước. */
export function previousPeriod({ start, end }: Period): Period {
  if (parts(end).day === 15 && start === monthPeriod(end).start) return monthPeriod(end, -1);
  const n = daysBetween(start, end) + 1;
  return { start: addDays(start, -n), end: addDays(start, -1) };
}

/** 12 tuần hoặc 6 tháng TS24 tới kỳ đang chạy vào `today`, cũ nhất trước. */
export function trendPeriods(unit: 'week' | 'month', today: IsoDate): Period[] {
  if (unit === 'week') {
    const s = weekPeriod(today).start;
    return Array.from({ length: 12 }, (_, i) => weekPeriod(addDays(s, -7 * (11 - i))));
  }
  const end = runningMonthPeriod(today).end;
  return Array.from({ length: 6 }, (_, i) => monthPeriod(end, i - 5));
}

/** Số tuần TS24: tuần 1 bắt đầu thứ Sáu đầu tiên của năm chứa `start`. */
export function tsWeekNumber(start: IsoDate): number {
  const jan1 = makeDate(parts(start).year, 1, 1);
  const firstFriday = addDays(jan1, (5 - dayOfWeek(jan1) + 7) % 7);
  return Math.round(daysBetween(firstFriday, start) / 7) + 1;
}

/** Kỳ của màn hình báo cáo, mới nhất trước: [0] đang chạy. WR 12 tuần, MR 6 tháng, QR 6 quý. */
export function reportPeriods(type: ReportType, today: IsoDate): ReportPeriod[] {
  const list =
    type === 'QR'
      ? [0, -1, -2, -3, -4, -5].map((o) => quarterPeriod(today, o))
      : trendPeriods(type === 'WR' ? 'week' : 'month', today).reverse();
  return list.map((p, i) => {
    const { year, month } = parts(p.end);
    const mm = `${pad2(month)}/${year}`;
    const label =
      type === 'WR'
        ? `Tuần ${tsWeekNumber(p.start)} tháng ${mm}`
        : type === 'MR'
          ? `Tháng ${mm}`
          : `Qúy ${pad2(month / 3)}/${year}`; // "Qúy" đúng chữ trong mẫu xlsx
    return { ...p, label, running: i === 0 };
  });
}
