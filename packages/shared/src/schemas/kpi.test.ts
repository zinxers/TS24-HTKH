// Chuyển từ HTKH-KPI/app/tests/submit.test.js (rowId, ticket, kenh, noiDung, trường thừa)
// và quy tắc spec Mốc 4 mục 5, 7.
import { describe, expect, it } from 'vitest';
import { DEFAULT_KPI_RATES, KENH, KENH_GROUPS, PHAN_LOAI } from '../kpi';
import {
  checkKpiRow,
  kpiRangeSchema,
  kpiRowSchema,
  kpiSubmitSchema,
  rateSetSchema,
  teamIdSchema,
  trendQuerySchema,
  userIdSchema,
} from './kpi';

const row = (over: Record<string, unknown> = {}) => ({
  rowId: 'row-0001',
  ticket: 'ticket/123',
  kenh: KENH[0],
  phanLoai: PHAN_LOAI[0],
  noiDung: 'Hướng dẫn',
  ...over,
});

describe('danh mục', () => {
  it('11 kênh, 3 phân loại, đơn giá đúng spec', () => {
    expect(KENH).toHaveLength(11);
    expect(PHAN_LOAI).toEqual(['Hỗ trợ sử dụng', 'Cấu hình phần mềm', 'Lỗi hệ thống, lỗi tích hợp']);
    expect(DEFAULT_KPI_RATES).toEqual({
      'PI Hoàn Thành': 1000,
      'PO Hoàn Thành': 1000,
      'PI Nhận thông tin': 600,
      'PO Nhận thông tin': 600,
      'Teamviewer Hoàn Thành': 2000,
      'Email Nhận thông tin': 600,
      'Email Hoàn Thành': 1500,
      'Chat Nhận thông tin': 600,
      'Chat Hoàn Thành': 1500,
      'Trường hợp khó': 4000,
      'Chăm sóc KH': 5000,
    });
  });

  it('6 nhóm, mỗi kênh đúng một lần', () => {
    expect(KENH_GROUPS).toHaveLength(6);
    expect(KENH_GROUPS.flatMap((g) => g.kenh).sort()).toEqual([...KENH].sort());
  });
});

describe('kpiRowSchema', () => {
  it('chuẩn hóa ticket; ticket sai báo đúng thông báo', () => {
    expect(kpiRowSchema.parse(row({ ticket: ' ticket / 123 ' })).ticket).toBe('TICKET/123');
    expect(checkKpiRow(row({ ticket: 'bad' })).errors).toEqual([
      { field: 'ticket', message: 'Ticket phải có dạng TICKET/số' },
    ]);
  });

  it.each([undefined, '  '])('rowId %j -> Thiếu mã dòng', (rowId) => {
    expect(checkKpiRow(row({ rowId })).errors).toEqual([{ field: 'rowId', message: 'Thiếu mã dòng' }]);
  });

  it.each(['=IMPORTXML("http://x","//a")', 'short', 'a'.repeat(65), 'row 0001x', "row'0001x", 'row_0001x', '+12345678', '@abcdefgh'])(
    'rowId %j -> Mã dòng không hợp lệ',
    (rowId) => {
      expect(checkKpiRow(row({ rowId })).errors).toEqual([{ field: 'rowId', message: 'Mã dòng không hợp lệ' }]);
    },
  );

  it.each(['3f2504e0-4f89-41d3-9a0c-0305e82c3301', 'abcdEF12', 'a'.repeat(64)])('rowId %j hợp lệ', (rowId) => {
    expect(checkKpiRow(row({ rowId })).errors).toEqual([]);
  });

  it('kenh sai và noiDung rỗng -> lỗi đúng hai field', () => {
    const { errors } = checkKpiRow(row({ kenh: 'Zalo', noiDung: '' }));
    expect(errors).toEqual([
      { field: 'kenh', message: 'Kênh - Tình trạng không hợp lệ' },
      { field: 'noiDung', message: 'Chưa nhập nội dung hỗ trợ' },
    ]);
  });

  it('phanLoai sai', () => {
    expect(checkKpiRow(row({ phanLoai: 'x' })).errors).toEqual([
      { field: 'phanLoai', message: 'Phân loại Ticket không hợp lệ' },
    ]);
  });

  it('noiDung 1000 ký tự được, 1001 bị chặn; NFD lưu NFC', () => {
    expect(checkKpiRow(row({ noiDung: 'x'.repeat(1000) })).errors).toEqual([]);
    expect(checkKpiRow(row({ noiDung: 'x'.repeat(1001) })).errors).toEqual([
      { field: 'noiDung', message: 'Nội dung hỗ trợ tối đa 1000 ký tự' },
    ]);
    const nfd = 'Hướng dẫn'.normalize('NFD');
    expect(nfd).not.toBe('Hướng dẫn');
    expect(kpiRowSchema.parse(row({ noiDung: nfd })).noiDung).toBe('Hướng dẫn');
  });

  it('bỏ trường thừa team, name, email, timestamp', () => {
    const out = kpiRowSchema.parse(row({ team: 'x', name: 'Hacker', email: 'h@x.com', timestamp: '1/1/2000' }));
    expect(Object.keys(out).sort()).toEqual(['kenh', 'noiDung', 'phanLoai', 'rowId', 'ticket']);
  });

  it.each([null, 5, [], 'x', undefined])('checkKpiRow(%j) có lỗi, không ném', (input) => {
    const r = checkKpiRow(input);
    expect(r.rowId).toBe('');
    expect(r.row).toBeUndefined();
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('checkKpiRow trả rowId từ input và row khi hợp lệ', () => {
    const r = checkKpiRow(row());
    expect(r.rowId).toBe('row-0001');
    expect(r.row?.ticket).toBe('TICKET/123');
    expect(checkKpiRow(row({ ticket: 'x' })).rowId).toBe('row-0001');
  });
});

describe('checkKpiRow phần tử không phải object', () => {
  it.each([5, null, [], 'x'.repeat(10000)])('trả "Dòng không hợp lệ" cho %#', (v) => {
    expect(checkKpiRow(v).errors).toEqual([{ field: '', message: 'Dòng không hợp lệ' }]);
  });
});

describe('kpiSubmitSchema', () => {
  const msg = (v: unknown) => kpiSubmitSchema.safeParse(v).error?.issues[0]?.message;
  it('1..200 phần tử, phần tử không kiểm ở đây', () => {
    expect(kpiSubmitSchema.safeParse({ rows: [null, 5, {}] }).success).toBe(true);
    expect(kpiSubmitSchema.safeParse({ rows: Array(200).fill(0) }).success).toBe(true);
    expect(msg({ rows: [] })).toBe('Không có dòng nào để gửi');
    expect(msg({ rows: Array(201).fill(0) })).toBe('Mỗi lần gửi tối đa 200 dòng');
  });
  it('rows không phải mảng -> lỗi', () => {
    expect(kpiSubmitSchema.safeParse({ rows: 'x' }).success).toBe(false);
    expect(kpiSubmitSchema.safeParse({}).success).toBe(false);
  });
});

describe('kpiRangeSchema', () => {
  const msg = (v: unknown) => kpiRangeSchema.safeParse(v).error?.issues[0]?.message;
  it('hợp lệ, gồm cả from = to và đúng 400 ngày', () => {
    expect(kpiRangeSchema.safeParse({ from: '2026-01-01', to: '2026-01-01' }).success).toBe(true);
    expect(kpiRangeSchema.safeParse({ from: '2026-01-01', to: '2027-02-04' }).success).toBe(true); // 400 ngày
  });
  it('from > to', () => {
    expect(msg({ from: '2026-02-02', to: '2026-02-01' })).toBe('Từ ngày phải trước hoặc bằng Đến ngày');
  });
  it('401 ngày bị chặn', () => {
    expect(kpiRangeSchema.safeParse({ from: '2026-01-01', to: '2027-02-05' }).success).toBe(false);
  });
  it('ngày không có thật', () => {
    expect(kpiRangeSchema.safeParse({ from: '2026-02-30', to: '2026-03-01' }).success).toBe(false);
  });
});

describe('rateSetSchema', () => {
  const rates = () => ({ ...DEFAULT_KPI_RATES });
  it('đủ 11 kênh số nguyên -> hợp lệ', () => {
    expect(rateSetSchema.safeParse({ from: '2026-11-20', rates: rates() }).success).toBe(true);
  });
  it('thiếu một kênh', () => {
    const rest: Partial<Record<string, number>> = rates();
    delete rest['Chăm sóc KH'];
    expect(rateSetSchema.safeParse({ from: '2026-11-20', rates: rest }).success).toBe(false);
  });
  it.each([1.5, -1, 1_000_001])('đơn giá %j bị chặn', (v) => {
    expect(rateSetSchema.safeParse({ from: '2026-11-20', rates: { ...rates(), 'Chăm sóc KH': v } }).success).toBe(false);
  });
  const messages = (input: unknown) => rateSetSchema.safeParse(input).error?.issues.map((i) => i.message);
  it('thiếu kênh → "Thiếu đơn giá kênh <kenh>"', () => {
    const rest: Partial<Record<string, number>> = rates();
    delete rest['Chăm sóc KH'];
    expect(messages({ from: '2026-11-20', rates: rest })).toEqual(['Thiếu đơn giá kênh Chăm sóc KH']);
  });
  it('kênh lạ → "Kênh - Tình trạng không hợp lệ"', () => {
    expect(messages({ from: '2026-11-20', rates: { ...rates(), 'Kênh lạ': 1 } })).toEqual([
      'Kênh - Tình trạng không hợp lệ',
    ]);
  });
  it.each([1.5, -1, 1_000_001, '5000', null])('đơn giá %j → thông báo tiếng Việt', (v) => {
    expect(messages({ from: '2026-11-20', rates: { ...rates(), 'Chăm sóc KH': v } })).toEqual([
      'Đơn giá phải là số nguyên từ 0 đến 1.000.000',
    ]);
  });
  it('ngày sai, thiếu ngày, rates không phải object, body không phải object → tiếng Việt', () => {
    expect(messages({ from: '2026-13-01', rates: rates() })).toEqual(['Ngày không hợp lệ']);
    expect(messages({ rates: rates() })).toEqual(['Ngày không hợp lệ']);
    expect(messages({ from: '2026-11-20', rates: 5 })).toEqual(['Đơn giá phải là số nguyên từ 0 đến 1.000.000']);
    expect(messages(null)).toEqual(['Dữ liệu đơn giá không hợp lệ']);
  });
  it('biên 0 và 1000000 hợp lệ', () => {
    expect(rateSetSchema.safeParse({ from: '2026-11-20', rates: { ...rates(), 'Chăm sóc KH': 0, 'Chat Hoàn Thành': 1_000_000 } }).success).toBe(true);
  });
});

describe('schema KPI theo team', () => {
  const uuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
  const msg = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message;

  it('teamIdSchema', () => {
    expect(teamIdSchema.safeParse(uuid).success).toBe(true);
    expect(msg(teamIdSchema.safeParse('abc'))).toBe('Team không hợp lệ');
  });

  it('userIdSchema', () => {
    expect(userIdSchema.safeParse(uuid).success).toBe(true);
    expect(msg(userIdSchema.safeParse('abc'))).toBe('Không tìm thấy thành viên');
  });

  it('trendQuerySchema', () => {
    expect(trendQuerySchema.safeParse({ team: 'all', unit: 'week' }).success).toBe(true);
    expect(trendQuerySchema.safeParse({ team: uuid, unit: 'month' }).success).toBe(true);
    expect(msg(trendQuerySchema.safeParse({ team: 'all', unit: 'day' }))).toBe('Kỳ không hợp lệ');
    expect(msg(trendQuerySchema.safeParse({ team: 'x', unit: 'week' }))).toBe('Team không hợp lệ');
  });
});
