import { describe, expect, it } from 'vitest';
import { reportNoteSaveSchema, reportQuerySchema, reportTypeSchema } from './report';

const TEAM = '6f1c1f0e-0000-4000-8000-000000000001';
const base = { start: '2026-11-20', scope: 'dept', fields: { sla: '98%' }, expectedVersion: null };
const msg = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
  r.error?.issues.map((i) => i.message).join('|');

describe('report schemas', () => {
  it('loại báo cáo', () => {
    expect(reportTypeSchema.parse('MR')).toBe('MR');
    expect(msg(reportTypeSchema.safeParse('XX'))).toBe('Loại báo cáo không hợp lệ');
  });

  it('query cần ngày hợp lệ', () => {
    expect(reportQuerySchema.safeParse({ start: '2026-11-20' }).success).toBe(true);
    expect(reportQuerySchema.safeParse({ start: '2026-13-40' }).success).toBe(false);
  });

  it('save: scope dept hoặc uuid, version null hoặc >= 1', () => {
    expect(reportNoteSaveSchema.safeParse(base).success).toBe(true);
    expect(reportNoteSaveSchema.safeParse({ ...base, scope: TEAM, expectedVersion: 3 }).success).toBe(true);
    expect(reportNoteSaveSchema.safeParse({ ...base, scope: 'abc' }).success).toBe(false);
    expect(reportNoteSaveSchema.safeParse({ ...base, expectedVersion: 0 }).success).toBe(false);
  });

  it('text: quá 2000 ký tự bị chặn, chuẩn hóa NFC/CRLF/trim', () => {
    const long = reportNoteSaveSchema.safeParse({ ...base, fields: { sla: 'a'.repeat(2001) } });
    expect(msg(long)).toBe('Mỗi ô tối đa 2.000 ký tự');
    const ok = reportNoteSaveSchema.parse({ ...base, fields: { sla: 'é\r\nx ' } });
    expect(ok.fields.sla).toBe('é\nx');
    expect(msg(reportNoteSaveSchema.safeParse({ ...base, fields: { sla: 5 } }))).toBe('Nội dung không hợp lệ');
  });
});
