// Ngày lịch dạng "YYYY-MM-DD", không mang giờ, không phụ thuộc múi giờ nơi chạy.
// Đây là file duy nhất trong logic kỳ được dùng `Date`, và chỉ dùng phần UTC.
export type IsoDate = string & { readonly __brand: 'IsoDate' };

const MS_PER_DAY = 86_400_000;

const toDays = (d: string): number =>
  Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) / MS_PER_DAY;

const fromDays = (n: number): IsoDate => new Date(n * MS_PER_DAY).toISOString().slice(0, 10) as IsoDate;

export function isIsoDate(s: string): s is IsoDate {
  // Đi một vòng qua số ngày: ngày không có thật (30/02) sẽ trôi sang ngày khác và không khớp.
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && fromDays(toDays(s)) === s;
}

export function isoDate(s: string): IsoDate {
  if (!isIsoDate(s)) throw new RangeError(`Ngày không hợp lệ: "${s}"`);
  return s;
}

/** `month` 1-12, được phép tràn (0 = tháng 12 năm trước, 13 = tháng 1 năm sau). */
export const makeDate = (year: number, month: number, day: number): IsoDate =>
  fromDays(Date.UTC(year, month - 1, day) / MS_PER_DAY);

export const addDays = (d: IsoDate, n: number): IsoDate => fromDays(toDays(d) + n);

/** 0 = Chủ nhật … 5 = thứ Sáu, 6 = thứ Bảy. */
export const dayOfWeek = (d: IsoDate): number => (((toDays(d) + 4) % 7) + 7) % 7; // 1970-01-01 là thứ Năm

/** `b - a` theo ngày. */
export const daysBetween = (a: IsoDate, b: IsoDate): number => toDays(b) - toDays(a);

export const parts = (d: IsoDate): { year: number; month: number; day: number } => ({
  year: Number(d.slice(0, 4)),
  month: Number(d.slice(5, 7)),
  day: Number(d.slice(8, 10)),
});

const vnFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Ngày theo giờ Việt Nam của một thời điểm. */
export const toVnDate = (instant: Date): IsoDate => isoDate(vnFormat.format(instant));
