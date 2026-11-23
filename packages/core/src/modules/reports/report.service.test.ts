import path from 'node:path';
import type { AuditEntry, ReportNoteInput, ReportNoteRow, TeamRow } from '@ts24-htkh/db';
import { isoDate, type CurrentUser, type IsoDate, type KpiRange, type ReportType } from '@ts24-htkh/shared';
import { describe, expect, it } from 'vitest';
import { ConflictError, ForbiddenError, ValidationError } from '../../errors';
import type { KpiTeamStore, ReportNoteStore, Repos, TeamStore, UnitOfWork } from '../../unit-of-work';
import { ReportService } from './report.service';
import { FsTemplateStore, type TemplateStore } from './template-store';

const T1 = '00000000-0000-4000-8000-000000000001';
const T2 = '00000000-0000-4000-8000-000000000002';
const T3 = '00000000-0000-4000-8000-000000000003';
const MISSING = '00000000-0000-4000-8000-0000000000ff';
const NOW = new Date('2026-11-23T03:00:00.000Z'); // 10:00 giờ Việt Nam
const WEEK = isoDate('2026-11-20'); // kỳ WR đang chạy
const OCT = isoDate('2026-10-16'); // kỳ MR 16/10 → 15/11, đã xong

const actor = (id: string, role: CurrentUser['role'], teamId: string | null): CurrentUser => ({
  id,
  email: `${id}@example.com`,
  fullName: `Tên ${id}`,
  role,
  teamId,
});
const H = actor('H', 'head', null);
const M = actor('M', 'manager', T1);
const S = actor('S', 'staff', T1);

const team = (id: string, name: string, sort: number) =>
  ({ id, name, short_name: `T${sort}`, sort_order: sort }) as TeamRow;

interface Line {
  teamId: string | null;
  userId: string;
  kenh: string;
  phanLoai: string;
  date: string;
}
const line = (teamId: string | null, userId: string, date: string, kenh = 'PI Hoàn Thành'): Line => ({
  teamId,
  userId,
  kenh,
  phanLoai: 'Hỗ trợ sử dụng',
  date,
});

class Fake {
  // Không theo sort_order: service phải tự xếp cột.
  teamRows = [team(T3, 'Team 3', 3), team(T1, 'Team 1', 1), team(T2, 'Team 2', 2)];
  lines: Line[] = [
    line(T1, 'a', '2026-11-01'),
    line(T1, 'b', '2026-11-02', 'Chat Hoàn Thành'),
    ...Array.from({ length: 5 }, () => line(T2, 'c', '2026-11-03')),
    line(null, 'd', '2026-11-04'),
    line(T1, 'a', '2026-10-01'),
    ...Array.from({ length: 5 }, () => line(T2, 'c', '2026-10-02')),
    line(T1, 'a', '2026-11-21'),
  ];
  notes = new Map<string, ReportNoteRow & { type: ReportType; periodStart: IsoDate }>();
  audits: AuditEntry[] = [];
  upserts = 0;

  teams = { list: async () => this.teamRows } as TeamStore;

  kpiTeam = {
    teamCells: async (teamId: string | null, r: KpiRange) =>
      this.lines
        .filter((l) => l.teamId === teamId && l.date >= r.from && l.date <= r.to)
        .map((l) => ({ userId: l.userId, kenh: l.kenh, phanLoai: l.phanLoai, count: 1, money: 0 })),
  } as KpiTeamStore;

  private key = (type: string, start: string, teamId: string | null) => `${type}|${start}|${teamId}`;

  reportNotes: ReportNoteStore = {
    list: async (type, start) => [...this.notes.values()].filter((n) => n.type === type && n.periodStart === start),
    findForUpdate: async (type, start, teamId) => this.notes.get(this.key(type, start, teamId)) ?? null,
    upsert: async (i: ReportNoteInput) => {
      this.upserts++;
      const k = this.key(i.type, i.periodStart, i.teamId);
      const cur = this.notes.get(k);
      if ((cur?.version ?? null) !== i.expectedVersion) return null;
      const row = {
        type: i.type,
        periodStart: i.periodStart,
        teamId: i.teamId,
        fields: i.fields,
        version: (cur?.version ?? 0) + 1,
        updatedAt: '2026-11-23T03:00:00.000Z',
        updatedByName: i.actorName,
      };
      this.notes.set(k, row);
      return row;
    },
  };

  uow: UnitOfWork = {
    transaction: (fn) =>
      fn({ reportNotes: this.reportNotes, audit: { record: async (e) => void this.audits.push(e) } } as Repos),
  };

  seed(type: ReportType, start: IsoDate, teamId: string | null, fields: Record<string, string>, version: number) {
    this.notes.set(this.key(type, start, teamId), {
      type,
      periodStart: start,
      teamId,
      fields,
      version,
      updatedAt: '2026-11-22T03:00:00.000Z',
      updatedByName: 'Người cũ',
    });
  }

  service(templates: TemplateStore = { load: async () => new Uint8Array() }) {
    return new ReportService({
      teams: this.teams,
      kpiTeam: this.kpiTeam,
      reportNotes: this.reportNotes,
      uow: this.uow,
      templates,
      now: () => NOW,
    });
  }
}

const err = async (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e);

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

describe('ReportService.saveNotes', () => {
  const dto = (scope: string, fields: Record<string, string>, expectedVersion: number | null, start = WEEK) => ({
    start,
    scope,
    fields,
    expectedVersion,
  });

  it('Quản lý sửa Cả phòng → 403; team không tồn tại → 400; key lạ → 400', async () => {
    const svc = new Fake().service();
    const e1 = await err(svc.saveNotes(M, 'WR', dto('dept', { sla: 'x' }, null)));
    expect(e1).toBeInstanceOf(ForbiddenError);
    expect((e1 as Error).message).toBe('Bạn không có quyền sửa nội dung này');
    expect(await err(svc.saveNotes(M, 'WR', dto(T2, { sla: 'x' }, null)))).toBeInstanceOf(ForbiddenError);
    const e2 = await err(svc.saveNotes(H, 'WR', dto(MISSING, { sla: 'x' }, null)));
    expect(e2).toBeInstanceOf(ValidationError);
    expect((e2 as Error).message).toBe('Team không hợp lệ');
    const e3 = await err(svc.saveNotes(H, 'WR', dto('dept', { slaTeam: 'x' }, null)));
    expect(e3).toBeInstanceOf(ValidationError);
    expect((e3 as Error).message).toBe('Nội dung không hợp lệ');
    expect(await err(svc.saveNotes(H, 'WR', dto(T1, { mrSla: 'x' }, null)))).toBeInstanceOf(ValidationError);
    const e4 = await err(svc.saveNotes(S, 'WR', dto(T1, { sla: 'x' }, null)));
    expect((e4 as Error).message).toBe('Bạn không có quyền sửa nội dung này');
    expect(await err(svc.saveNotes(H, 'WR', dto('dept', { sla: 'x' }, null, isoDate('2026-11-21'))))).toBeInstanceOf(
      ValidationError,
    );
  });

  it('version lệch → 409', async () => {
    const f = new Fake();
    f.seed('WR', WEEK, T1, { sla: 'a' }, 2);
    const svc = f.service();
    for (const p of [
      svc.saveNotes(M, 'WR', dto(T1, { sla: 'b' }, 1)),
      svc.saveNotes(M, 'WR', dto(T2, { sla: 'b' }, 2)),
      svc.saveNotes(H, 'WR', dto(T2, { sla: 'b' }, 2)),
      svc.saveNotes(M, 'WR', dto(T1, { sla: 'b' }, null)),
    ]) {
      const e = await err(p);
      if (e instanceof ForbiddenError) continue; // M sửa T2
      expect(e).toBeInstanceOf(ConflictError);
      expect((e as Error).message).toBe('Nội dung vừa được người khác sửa, vui lòng tải lại');
    }
    expect(f.upserts).toBe(0);
    expect(f.audits).toEqual([]);
  });

  it('upsert trả null (ghi đồng thời) → 409', async () => {
    const f = new Fake();
    f.reportNotes.upsert = async () => null;
    const e = await err(f.service().saveNotes(H, 'WR', dto('dept', { sla: 'x' }, null)));
    expect(e).toBeInstanceOf(ConflictError);
    expect(f.audits).toEqual([]);
  });

  it('không đổi gì → không upsert, không audit', async () => {
    const f = new Fake();
    f.seed('WR', WEEK, T1, { sla: 'a', keHoach: 'k' }, 2);
    const out = await f.service().saveNotes(M, 'WR', dto(T1, { keHoach: 'k', sla: 'a', repeat: '' }, 2));
    expect(f.upserts).toBe(0);
    expect(f.audits).toEqual([]);
    expect(out.scopes).toEqual([
      { scope: T1, fields: { sla: 'a', keHoach: 'k' }, version: 2, updatedAt: '2026-11-22T03:00:00.000Z', updatedByName: 'Người cũ' },
    ]);
  });

  it('có đổi → upsert bỏ chữ rỗng, audit không chứa chữ, trả notes mới', async () => {
    const f = new Fake();
    f.seed('WR', WEEK, T1, { sla: 'a', keHoach: 'k' }, 2);
    const out = await f.service().saveNotes(M, 'WR', dto(T1, { sla: 'bí mật', keHoach: '', repeat: 'r' }, 2));
    expect(f.notes.get(`WR|${WEEK}|${T1}`)!.fields).toEqual({ sla: 'bí mật', repeat: 'r' });
    expect(f.audits).toEqual([
      {
        actorId: 'M',
        action: 'report.note.save',
        targetId: T1,
        detail: { type: 'WR', periodStart: WEEK, scope: T1, keys: ['keHoach', 'repeat', 'sla'] },
      },
    ]);
    expect(JSON.stringify(f.audits)).not.toContain('bí mật');
    expect(out.scopes[0]).toMatchObject({ scope: T1, version: 3, updatedByName: 'Tên M', fields: { sla: 'bí mật', repeat: 'r' } });
  });

  it('Trưởng phòng tạo mới Cả phòng', async () => {
    const f = new Fake();
    const out = await f.service().saveNotes(H, 'MR', dto('dept', { mrSla: '99%' }, null, OCT));
    expect(f.audits[0]).toMatchObject({ targetId: null, detail: { scope: 'dept', keys: ['mrSla'] } });
    expect(out.scopes.map((s) => s.scope)).toEqual(['dept', T1, T2, T3]);
    expect(out.scopes[0]).toMatchObject({ fields: { mrSla: '99%' }, version: 1 });
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
