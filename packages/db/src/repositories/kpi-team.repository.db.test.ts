import type { KpiRange } from '@ts24-htkh/shared';
import { afterAll, describe, expect, it } from 'vitest';
import type { Sql } from '../client';
import { adminSql, inRollback } from '../test/db';
import { KpiReportRepository, type NewKpiReport } from './kpi-report.repository';
import { KpiTeamRepository } from './kpi-team.repository';

afterAll(async () => {
  await adminSql().end();
});

const range = (from: string, to: string) => ({ from, to }) as KpiRange;
const R = range('2031-10-01', '2031-10-31');

async function fixture(tx: Sql) {
  await tx`set local session_replication_role = replica`; // cho phép đặt created_at
  const users = await tx<{ id: string }[]>`select id from app_user where deleted_at is null order by created_at limit 2`;
  const teams = await tx<{ id: string }[]>`select id from team order by sort_order limit 2`;
  return { a: users[0]!.id, b: users[1]!.id, t1: teams[0]!.id, t2: teams[1]!.id };
}

const row = (userId: string, rowId: string, o: Partial<NewKpiReport> = {}): NewKpiReport => ({
  rowId,
  userId,
  fullName: 'Tên',
  teamId: null,
  ticket: 'TICKET/1',
  kenh: 'Chăm sóc KH',
  phanLoai: 'Hỗ trợ sử dụng',
  noiDung: 'x',
  ...o,
});

/** Chèn dòng rồi đặt created_at cố định. */
async function put(tx: Sql, rows: [NewKpiReport, string][]) {
  await new KpiReportRepository(tx).insertMany(rows.map(([r]) => r));
  for (const [r, at] of rows) await tx`update kpi_report set created_at = ${at} where row_id = ${r.rowId}`;
}

describe('KpiTeamRepository', () => {
  it('teamCells chỉ đếm dòng có team_id đó; teamCells(null) chỉ đếm dòng không team', async () => {
    await inRollback(adminSql(), async (tx) => {
      const { a, b, t1, t2 } = await fixture(tx);
      await put(tx, [
        [row(a, 'tt-0000001', { teamId: t1 }), '2031-10-05T05:00:00Z'],
        [row(b, 'tt-0000002', { teamId: t2 }), '2031-10-05T05:00:00Z'],
        [row(b, 'tt-0000003', { teamId: null, kenh: 'PI Hoàn Thành' }), '2031-10-05T05:00:00Z'],
      ]);
      const repo = new KpiTeamRepository(tx);
      expect(await repo.teamCells(t1, R)).toEqual([
        { userId: a, kenh: 'Chăm sóc KH', phanLoai: 'Hỗ trợ sử dụng', count: 1, money: expect.any(Number) },
      ]);
      const none = await repo.teamCells(null, R);
      expect(none).toHaveLength(1);
      expect(none[0]).toMatchObject({ userId: b, kenh: 'PI Hoàn Thành', count: 1 });
      expect(await repo.countByTeam(R)).toEqual(
        expect.arrayContaining([
          { teamId: t1, count: 1 },
          { teamId: t2, count: 1 },
          { teamId: null, count: 1 },
        ]),
      );
    });
  });

  it('người chuyển team: dòng cũ ở team cũ, dòng mới ở team mới; latestNames trả full_name chụp trên dòng', async () => {
    await inRollback(adminSql(), async (tx) => {
      const { a, t1, t2 } = await fixture(tx);
      await put(tx, [
        [row(a, 'tt-0000001', { teamId: t1, fullName: 'Tên Cũ' }), '2031-10-05T05:00:00Z'],
        [row(a, 'tt-0000002', { teamId: t2, fullName: 'Tên Mới' }), '2031-10-06T05:00:00Z'],
      ]);
      const repo = new KpiTeamRepository(tx);
      expect((await repo.teamCells(t1, R)).map((c) => c.count)).toEqual([1]);
      expect((await repo.teamCells(t2, R)).map((c) => c.count)).toEqual([1]);
      expect(await repo.latestNames(t1, R)).toEqual([{ userId: a, fullName: 'Tên Cũ' }]);
      expect(await repo.latestNames(t2, R)).toEqual([{ userId: a, fullName: 'Tên Mới' }]);
    });
  });

  it('latestNames lấy tên của dòng mới nhất trong cùng team', async () => {
    await inRollback(adminSql(), async (tx) => {
      const { a, t1 } = await fixture(tx);
      await put(tx, [
        [row(a, 'tt-0000001', { teamId: t1, fullName: 'Tên Cũ' }), '2031-10-05T05:00:00Z'],
        [row(a, 'tt-0000002', { teamId: t1, fullName: 'Tên Mới' }), '2031-10-06T05:00:00Z'],
      ]);
      expect(await new KpiTeamRepository(tx).latestNames(t1, R)).toEqual([{ userId: a, fullName: 'Tên Mới' }]);
    });
  });

  it('daysByUser đếm ngày của mọi team, hai dòng cùng ngày VN tính 1', async () => {
    await inRollback(adminSql(), async (tx) => {
      const { a, b, t1, t2 } = await fixture(tx);
      await put(tx, [
        [row(a, 'tt-0000001', { teamId: t1 }), '2031-10-05T01:00:00Z'], // 08:00 VN 05/10
        [row(a, 'tt-0000002', { teamId: t2 }), '2031-10-05T16:30:00Z'], // 23:30 VN 05/10
        [row(a, 'tt-0000003', { teamId: t2 }), '2031-10-06T05:00:00Z'],
        [row(b, 'tt-0000004', { teamId: null }), '2031-10-06T05:00:00Z'],
      ]);
      const repo = new KpiTeamRepository(tx);
      const days = await repo.daysByUser([a, b], R);
      expect(days).toEqual(expect.arrayContaining([{ userId: a, days: 2 }, { userId: b, days: 1 }]));
      expect(await repo.daysByUser([], R)).toEqual([]);
    });
  });

  it('teamItems: dòng của một người trong team, mới nhất trước', async () => {
    await inRollback(adminSql(), async (tx) => {
      const { a, b, t1, t2 } = await fixture(tx);
      await put(tx, [
        [row(a, 'tt-0000001', { teamId: t1, ticket: 'TICKET/2' }), '2031-10-05T05:00:00Z'],
        [row(a, 'tt-0000002', { teamId: t1, ticket: 'TICKET/3' }), '2031-10-06T05:00:00Z'],
        [row(a, 'tt-0000003', { teamId: t2, ticket: 'TICKET/4' }), '2031-10-06T06:00:00Z'],
        [row(b, 'tt-0000004', { teamId: t1, ticket: 'TICKET/5' }), '2031-10-06T07:00:00Z'],
      ]);
      const items = await new KpiTeamRepository(tx).teamItems(t1, a, R);
      expect(items.map((i) => i.ticket)).toEqual(['TICKET/3', 'TICKET/2']);
    });
  });

  it('dòng xóa mềm không được đếm', async () => {
    await inRollback(adminSql(), async (tx) => {
      const { a, t1 } = await fixture(tx);
      await put(tx, [
        [row(a, 'tt-0000001', { teamId: t1 }), '2031-10-05T05:00:00Z'],
        [row(a, 'tt-0000002', { teamId: t1 }), '2031-10-05T06:00:00Z'],
      ]);
      await tx`update kpi_report set deleted_at = now(), delete_reason = 'test' where row_id = 'tt-0000002'`;
      const repo = new KpiTeamRepository(tx);
      expect((await repo.teamCells(t1, R)).map((c) => c.count)).toEqual([1]);
      expect(await repo.teamItems(t1, a, R)).toHaveLength(1);
      expect(await repo.daysByUser([a], R)).toEqual([{ userId: a, days: 1 }]);
    });
  });

  it('đổi giá giữa kỳ: money cộng đúng hai mức giá', async () => {
    await inRollback(adminSql(), async (tx) => {
      const { a, t1 } = await fixture(tx);
      await tx`insert into kpi_rate (effective_from, kenh, amount)
        values ('2031-10-09', 'Chăm sóc KH', 6000), ('2031-10-10', 'Chăm sóc KH', 7000)`;
      await put(tx, [
        [row(a, 'tt-0000001', { teamId: t1 }), '2031-10-09T05:00:00Z'],
        [row(a, 'tt-0000002', { teamId: t1 }), '2031-10-10T05:00:00Z'],
      ]);
      const [cell] = await new KpiTeamRepository(tx).teamCells(t1, R);
      expect(cell).toMatchObject({ count: 2, money: 13000 });
    });
  });

  it('trend: 2031-11-19T16:30:00Z thuộc kỳ 2031-11-13..2031-11-19, không thuộc kỳ 2031-11-20..2031-11-26', async () => {
    await inRollback(adminSql(), async (tx) => {
      const { a, t1 } = await fixture(tx);
      await put(tx, [[row(a, 'tt-0000001', { teamId: t1 }), '2031-11-19T16:30:00Z']]); // 23:30 VN 19/11
      const periods = [range('2031-11-13', '2031-11-19'), range('2031-11-20', '2031-11-26')];
      const out = await new KpiTeamRepository(tx).trend(periods, t1);
      expect(out).toEqual([{ index: 0, teamId: t1, count: 1, money: expect.any(Number) }]);
    });
  });

  it('trend(…, teamId) chỉ trả team đó; trend(…, "all") có cả teamId null', async () => {
    await inRollback(adminSql(), async (tx) => {
      const { a, b, t1, t2 } = await fixture(tx);
      await put(tx, [
        [row(a, 'tt-0000001', { teamId: t1 }), '2031-11-14T05:00:00Z'],
        [row(b, 'tt-0000002', { teamId: t2 }), '2031-11-14T05:00:00Z'],
        [row(b, 'tt-0000003', { teamId: null }), '2031-11-21T05:00:00Z'],
      ]);
      const periods = [range('2031-11-13', '2031-11-19'), range('2031-11-20', '2031-11-26')];
      const repo = new KpiTeamRepository(tx);
      expect((await repo.trend(periods, t1)).map((r) => [r.index, r.teamId])).toEqual([[0, t1]]);
      const all = await repo.trend(periods, 'all');
      expect(all).toHaveLength(3);
      expect(all.find((r) => r.index === 1)).toMatchObject({ teamId: null, count: 1 });
    });
  });
});
