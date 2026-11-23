import type { IsoDate } from '@ts24-htkh/shared';
import { afterAll, describe, expect, it } from 'vitest';
import type { Sql } from '../client';
import { adminSql, inRollback } from '../test/db';
import { ReportNoteRepository } from './report-note.repository';

afterAll(async () => {
  await adminSql().end();
});

const P = '2031-10-02' as IsoDate;

async function fixture(tx: Sql) {
  const [u] = await tx<{ id: string }[]>`select id from app_user where deleted_at is null order by created_at limit 1`;
  const [t] = await tx<{ id: string }[]>`select id from team order by sort_order limit 1`;
  return { actorId: u!.id, teamId: t!.id };
}

describe('ReportNoteRepository', () => {
  it('upsert lần đầu version 1, lần hai version 2 cùng dòng', async () => {
    await inRollback(adminSql(), async (tx) => {
      const { actorId, teamId } = await fixture(tx);
      const repo = new ReportNoteRepository(tx);
      const base = { type: 'WR' as const, periodStart: P, teamId, actorId, actorName: 'Tên' };
      const a = await repo.upsert({ ...base, fields: { a: 'x' } });
      const b = await repo.upsert({ ...base, fields: { a: 'y' } });
      expect([a.version, b.version]).toEqual([1, 2]);
      expect(b.fields).toEqual({ a: 'y' });
      expect(b.updatedByName).toBe('Tên');
      expect(await repo.findForUpdate('WR', P, teamId)).toMatchObject({ version: 2 });
      expect(await repo.findForUpdate('MR', P, teamId)).toBeNull();
      const [c] = await tx<{ n: number }[]>`select count(*)::int as n from report_note`;
      expect(c!.n).toBe(1);
    });
  });

  it('team_id null là một dòng duy nhất cho mỗi loại + kỳ', async () => {
    await inRollback(adminSql(), async (tx) => {
      const { actorId } = await fixture(tx);
      const repo = new ReportNoteRepository(tx);
      const base = { type: 'MR' as const, periodStart: P, teamId: null, actorId, actorName: 'Tên' };
      await repo.upsert({ ...base, fields: {} });
      const second = await repo.upsert({ ...base, fields: { k: 'v' } });
      expect(second.version).toBe(2);
      await expect(
        tx`insert into report_note (report_type, period_start, team_id, updated_by, updated_by_name)
           values ('MR', ${P}::date, null, ${actorId}::uuid, 'x')`,
      ).rejects.toMatchObject({ code: '23505' });
    });
  });

  it('list trả các phạm vi của đúng loại + kỳ', async () => {
    await inRollback(adminSql(), async (tx) => {
      const { actorId, teamId } = await fixture(tx);
      const repo = new ReportNoteRepository(tx);
      const b = { periodStart: P, actorId, actorName: 'Tên', fields: { k: 'v' } };
      await repo.upsert({ ...b, type: 'QR', teamId: null });
      await repo.upsert({ ...b, type: 'QR', teamId });
      await repo.upsert({ ...b, type: 'WR', teamId });
      await repo.upsert({ ...b, type: 'QR', teamId, periodStart: '2031-10-09' as IsoDate });
      const rows = await repo.list('QR', P);
      expect(rows.map((r) => r.teamId).sort()).toEqual([null, teamId].sort());
    });
  });

  it("report_type 'XR' bị từ chối", async () => {
    await inRollback(adminSql(), async (tx) => {
      const { actorId } = await fixture(tx);
      await expect(
        tx`insert into report_note (report_type, period_start, updated_by, updated_by_name)
           values ('XR', ${P}::date, ${actorId}::uuid, 'x')`,
      ).rejects.toMatchObject({ code: '23514' });
    });
  });

  it('bảng report_note bật RLS', async () => {
    const [r] = await adminSql()<{ rls: boolean }[]>`
      select relrowsecurity as rls from pg_class where oid = 'public.report_note'::regclass`;
    expect(r!.rls).toBe(true);
  });
});
