import path from 'node:path';
import { isoDate } from '@ts24-htkh/shared';
import { describe, expect, it } from 'vitest';
import { ForbiddenError, ValidationError } from '../../errors';
import { actor, err, Fake, H, line, M, OCT, S, T1, T2, T3, WEEK } from './report.service.fakes';
import { FsTemplateStore } from './template-store';

describe('ReportService quyền và kỳ', () => {
  it('Nhân viên xem trước → 403', async () => {
    const e = await err(new Fake().service().preview(S, 'WR', WEEK));
    expect(e).toBeInstanceOf(ForbiddenError);
    expect((e as Error).message).toBe('Bạn không có quyền xem báo cáo');
  });

  it('Quản lý không có team → 403', async () => {
    expect(await err(new Fake().service().notes(actor('M0', 'manager', null), 'WR', WEEK))).toBeInstanceOf(ForbiddenError);
  });

  it('start không thuộc reportPeriods → 400', async () => {
    const svc = new Fake().service();
    for (const p of [svc.preview(H, 'WR', isoDate('2026-11-21')), svc.notes(H, 'MR', isoDate('2026-11-20'))]) {
      const e = await err(p);
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as Error).message).toBe('Kỳ báo cáo không hợp lệ');
    }
  });
});

describe('ReportService.preview', () => {
  it('Trưởng phòng: 3 team theo sort_order, dòng WR, phạm vi chữ Cả phòng + 3 team', async () => {
    const f = new Fake();
    const p = await f.service().preview(H, 'WR', isoDate('2026-10-30'));
    expect(p.teams.map((t) => t?.id)).toEqual([T1, T2, T3]);
    expect(p.teams[0]).toEqual({ id: T1, name: 'Team 1', shortName: 'T1' });
    expect(p.period.start).toBe('2026-10-30');
    expect(p.total).toBe(7);
    expect(p.trend).toBeNull();
    expect(p.rows.map((r) => r.label)).toEqual([
      'Tổng đài (ĐT)',
      'Chat',
      'Email',
      'Hoàn thành',
      'Lỗi hệ thống, lỗi tích hợp',
      'Cấu hình phần mềm',
      'Hỗ trợ sử dụng',
    ]);
    expect(p.rows[0]!.values).toEqual([1, 5, 0]);
    expect(p.rows[1]!.values).toEqual([1, 0, 0]);
    expect(p.notes.scopes.map((s) => s.scope)).toEqual(['dept', T1, T2, T3]);
    expect(p.notes.scopes[0]).toEqual({ scope: 'dept', fields: {}, version: null, updatedAt: null, updatedByName: null });
  });

  it('Quản lý: chỉ team mình, phạm vi chữ chỉ team mình', async () => {
    const p = await new Fake().service().preview(M, 'WR', isoDate('2026-10-30'));
    expect(p.teams.map((t) => t?.id ?? null)).toEqual([T1, null, null]);
    expect(p.rows[0]!.values).toEqual([1, null, null]);
    expect(p.total).toBe(2);
    expect(p.notes.scopes.map((s) => s.scope)).toEqual([T1]);
  });

  it('QR: dòng Ticket xử lý / nhân sự', async () => {
    const p = await new Fake().service().preview(H, 'QR', isoDate('2026-09-16'));
    expect(p.rows).toEqual([{ label: 'Ticket xử lý / nhân sự', values: [2, 10, null] }]);
    expect(p.total).toBe(14);
  });

  it('MR: prevTotal cùng phạm vi (Quản lý chỉ team mình)', async () => {
    const f = new Fake();
    // Tháng 16/10-15/11: T1 2, T2 5. Tháng trước 16/09-15/10: T1 1, T2 5.
    expect((await f.service().preview(M, 'MR', OCT)).trend).toBe('↑'); // 2 > 1
    expect((await f.service().preview(H, 'MR', OCT)).trend).toBe('↑'); // 7 > 6
    f.lines.push(line(T2, 'c', '2026-10-03'), line(T2, 'c', '2026-10-04'));
    expect((await f.service().preview(H, 'MR', OCT)).trend).toBe('↓'); // 7 < 8
    expect((await f.service().preview(M, 'MR', OCT)).trend).toBe('↑'); // vẫn 2 > 1
    expect((await f.service().preview(H, 'MR', isoDate('2026-11-16'))).trend).toBeNull(); // đang chạy
  });
});

describe('ReportService.file', () => {
  const templates = new FsTemplateStore(path.resolve(process.cwd(), '..', '..', 'templates'));

  it('có 2 team → lỗi cấu hình', async () => {
    const f = new Fake();
    f.teamRows = f.teamRows.slice(0, 2);
    await expect(f.service(templates).file(H, 'WR', WEEK)).rejects.toThrow('Cần đúng 3 team để điền báo cáo');
  });

  it('điền mẫu, tên theo ngày xuất giờ Việt Nam', async () => {
    const f = new Fake();
    f.seed('WR', WEEK, null, { sla: 'Đạt mục tiêu' }, 1);
    const out = await f.service(templates).file(H, 'WR', WEEK);
    expect(out.fileName).toBe('WR-TEC-261123.xlsx');
    expect([...out.bytes.slice(0, 2)]).toEqual([0x50, 0x4b]); // "PK"
  });

  it('Nhân viên → 403', async () => {
    expect(await err(new Fake().service(templates).file(S, 'WR', WEEK))).toBeInstanceOf(ForbiddenError);
  });
});

describe('FsTemplateStore', () => {
  it('đọc report-<type>.xlsx và giữ trong bộ nhớ', async () => {
    const store = new FsTemplateStore(path.resolve(process.cwd(), '..', '..', 'templates'));
    const a = await store.load('QR');
    expect(a.length).toBeGreaterThan(0);
    expect(await store.load('QR')).toBe(a);
  });
});
