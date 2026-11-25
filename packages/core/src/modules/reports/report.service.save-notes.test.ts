import { isoDate } from '@ts24-htkh/shared';
import { describe, expect, it } from 'vitest';
import { ConflictError, ForbiddenError, ValidationError } from '../../errors';
import { err, Fake, H, M, MISSING, OCT, S, T1, T2, T3, WEEK } from './report.service.fakes';

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
    const cases = [
      svc.saveNotes(M, 'WR', dto(T1, { sla: 'b' }, 1)), // có dòng v2, gửi 1
      svc.saveNotes(H, 'WR', dto(T2, { sla: 'b' }, 2)), // chưa có dòng, gửi số
      svc.saveNotes(M, 'WR', dto(T1, { sla: 'b' }, null)), // có dòng, gửi null
    ];
    for (const p of cases) {
      const e = await err(p);
      expect(e).toBeInstanceOf(ConflictError);
      expect((e as Error).message).toBe('Nội dung vừa được người khác sửa, vui lòng tải lại');
    }
    // Chữ của người ghi trước giữ nguyên.
    expect(f.notes.get(`WR|${WEEK}|${T1}`)).toMatchObject({ fields: { sla: 'a' }, version: 2, updatedByName: 'Người cũ' });
    expect(f.notes.has(`WR|${WEEK}|${T2}`)).toBe(false);
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
        targetId: null,
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
