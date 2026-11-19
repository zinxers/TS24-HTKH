import { z } from 'zod';
import { daysBetween, isIsoDate, type IsoDate } from '../date';
import { KENH, MAX_NOI_DUNG, MAX_RANGE_DAYS, MAX_RATE, MAX_ROWS_PER_SUBMIT, PHAN_LOAI, type Kenh } from '../kpi';

// Thông báo giữ nguyên văn hệ thống cũ HTKH-KPI.
const MSG = {
  rowIdMissing: 'Thiếu mã dòng',
  rowObject: 'Dòng không hợp lệ',
  rowIdInvalid: 'Mã dòng không hợp lệ',
  ticket: 'Ticket phải có dạng TICKET/số',
  kenh: 'Kênh - Tình trạng không hợp lệ',
  phanLoai: 'Phân loại Ticket không hợp lệ',
  noiDungEmpty: 'Chưa nhập nội dung hỗ trợ',
  noiDungMax: `Nội dung hỗ trợ tối đa ${MAX_NOI_DUNG} ký tự`,
};

const nfcTrim = (v: unknown) => (typeof v === 'string' ? v.normalize('NFC').trim() : v);

const rowId = z
  .string({ error: (i) => (i.input === undefined ? MSG.rowIdMissing : MSG.rowIdInvalid) })
  .superRefine((s, ctx) => {
    if (s.trim() === '') ctx.addIssue({ code: 'custom', message: MSG.rowIdMissing });
    else if (!/^[A-Za-z0-9-]{8,64}$/.test(s)) ctx.addIssue({ code: 'custom', message: MSG.rowIdInvalid });
  });

// NFC, bỏ mọi khoảng trắng, viết hoa rồi mới kiểm.
const ticket = z.preprocess(
  (v) => (typeof v === 'string' ? v.normalize('NFC').replace(/\s+/g, '').toUpperCase() : v),
  z.string({ error: MSG.ticket }).regex(/^TICKET\/[0-9]+$/, MSG.ticket),
);

/** Trường thừa (team, name, email, timestamp...) bị zod bỏ: server lấy từ người dùng đang đăng nhập. */
export const kpiRowSchema = z.object(
  {
    rowId,
    ticket,
    kenh: z.preprocess(nfcTrim, z.enum(KENH, { error: MSG.kenh })),
    phanLoai: z.preprocess(nfcTrim, z.enum(PHAN_LOAI, { error: MSG.phanLoai })),
    noiDung: z.preprocess(
      nfcTrim,
      z.string({ error: MSG.noiDungEmpty }).min(1, MSG.noiDungEmpty).max(MAX_NOI_DUNG, MSG.noiDungMax),
    ),
  },
  { error: MSG.rowObject },
);
export type KpiRowInput = z.infer<typeof kpiRowSchema>;

/** Từng phần tử kiểm riêng bằng `checkKpiRow` để trả lỗi theo dòng. */
export const kpiSubmitSchema = z.object({
  rows: z
    .array(z.unknown())
    .min(1, 'Không có dòng nào để gửi')
    .max(MAX_ROWS_PER_SUBMIT, `Mỗi lần gửi tối đa ${MAX_ROWS_PER_SUBMIT} dòng`),
});

export function checkKpiRow(input: unknown): {
  rowId: string;
  row?: KpiRowInput;
  errors: { field: string; message: string }[];
} {
  const id = (input as { rowId?: unknown } | null)?.rowId;
  const rowIdOut = typeof id === 'string' ? id : '';
  const r = kpiRowSchema.safeParse(input);
  if (r.success) return { rowId: rowIdOut, row: r.data, errors: [] };
  return {
    rowId: rowIdOut,
    errors: r.error.issues.map((i) => ({ field: String(i.path[0] ?? ''), message: i.message })),
  };
}

const isoDateField = z.custom<IsoDate>((v) => typeof v === 'string' && isIsoDate(v), 'Ngày không hợp lệ');

export const kpiRangeSchema = z
  .object({ from: isoDateField, to: isoDateField })
  .refine((v) => v.from <= v.to, { message: 'Từ ngày phải trước hoặc bằng Đến ngày', path: ['from'] })
  .refine((v) => daysBetween(v.from, v.to) < MAX_RANGE_DAYS, {
    message: `Khoảng ngày tối đa ${MAX_RANGE_DAYS} ngày`,
    path: ['to'],
  });
export type KpiRange = z.infer<typeof kpiRangeSchema>;

const MSG_RATE = 'Đơn giá phải là số nguyên từ 0 đến 1.000.000';

const rateAmount = (kenh: Kenh) =>
  z
    .number({ error: (i) => (i.input === undefined ? `Thiếu đơn giá kênh ${kenh}` : MSG_RATE) })
    .int(MSG_RATE)
    .min(0, MSG_RATE)
    .max(MAX_RATE, MSG_RATE);

/** Đủ đúng 11 kênh: thiếu kênh hoặc kênh lạ đều bị chặn. */
const rates = z.strictObject(
  Object.fromEntries(KENH.map((k) => [k, rateAmount(k)])) as Record<Kenh, ReturnType<typeof rateAmount>>,
  { error: (i) => (i.code === 'unrecognized_keys' ? MSG.kenh : MSG_RATE) },
);

export const rateSetSchema = z.object({ from: isoDateField, rates }, { error: 'Dữ liệu đơn giá không hợp lệ' });
export type RateSetInput = z.infer<typeof rateSetSchema>;
