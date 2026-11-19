import { KENH, type KpiRange } from '@ts24-htkh/shared';
import { afterAll, describe, expect, it } from 'vitest';
import type { Sql } from '../client';
import { adminSql, appSql, inRollback } from '../test/db';
import { KpiRateRepository } from './kpi-rate.repository';
import { KpiReportRepository, type NewKpiReport } from './kpi-report.repository';

afterAll(async () => {
  await appSql().end();
  await adminSql().end();
});

const range = (from: string, to: string) => ({ from, to }) as KpiRange;

async function twoUsers(tx: Sql) {
  const rows = await tx<{ id: string }[]>`select id from app_user where deleted_at is null order by created_at limit 2`;
  return [rows[0]!.id, rows[1]!.id] as const;
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

const row = (userId: string, o: Partial<NewKpiReport> = {}): NewKpiReport => ({
  rowId: 'repo-0000001',
  userId,
  fullName: 'Tên',
  teamId: null,
  ticket: 'TICKET/1',
  kenh: 'Chăm sóc KH',
  phanLoai: 'Hỗ trợ sử dụng',
  noiDung: 'x',
  ...o,
});

describe('KpiReportRepository', () => {
  it('insertMany hai lần cùng row_id: lần 1 trả [rowId], lần 2 trả [], DB có 1 dòng', async () => {
    await inRollback(appSql(), async (tx) => {
      const [a] = await twoUsers(tx);
      const repo = new KpiReportRepository(tx);
      expect(await repo.insertMany([row(a)])).toEqual(['repo-0000001']);
      expect(await repo.insertMany([row(a)])).toEqual([]);
      const [c] = await tx<{ n: string }[]>`select count(*) as n from kpi_report where row_id = 'repo-0000001'`;
      expect(Number(c!.n)).toBe(1);
    });
  });

  it('lọc khoảng theo ngày VN: 23:30 VN (16:30Z) thuộc ngày đó', async () => {
    await inRollback(adminSql(), async (tx) => {
      await tx`set local session_replication_role = replica`; // cho phép đặt created_at
      const [a] = await twoUsers(tx);
      const repo = new KpiReportRepository(tx);
      await repo.insertMany([row(a), row(a, { rowId: 'repo-0000002' })]);
      await tx`update kpi_report set created_at = '2031-10-09T16:30:00Z' where row_id = 'repo-0000001'`; // 23:30 VN, 09/10
      await tx`update kpi_report set created_at = '2031-10-09T17:30:00Z' where row_id = 'repo-0000002'`; // 00:30 VN, 10/10
      const day = (d: string) => range(d, d);
      const ids = async (d: string) => (await repo.listMine(a, day(d))).length;
      for (const [d, n] of [['2031-10-09', 1], ['2031-10-10', 1]] as const) {
        expect((await repo.summaryByKenh(a, day(d))).map((r) => r.count)).toEqual([n]);
        expect(await ids(d)).toBe(n);
        expect(await repo.countByDay(a, day(d))).toEqual([{ date: d, count: n }]);
      }
      expect(await repo.countByDay(a, range('2031-10-09', '2031-10-10'))).toEqual([
        { date: '2031-10-09', count: 1 },
        { date: '2031-10-10', count: 1 },
      ]);
      expect(await repo.countByPhanLoai(a, range('2031-10-09', '2031-10-10'))).toEqual([
        { phanLoai: 'Hỗ trợ sử dụng', count: 2 },
      ]);
    });
  });

  it('hai mức giá trong khoảng: distinctAmounts = 2, total = tổng hai giá', async () => {
    await inRollback(adminSql(), async (tx) => {
      await tx`set local session_replication_role = replica`;
      await tx`insert into kpi_rate (effective_from, kenh, amount)
        values ('2031-10-09', 'Chăm sóc KH', 6000), ('2031-10-10', 'Chăm sóc KH', 7000)`;
      const [a] = await twoUsers(tx);
      const repo = new KpiReportRepository(tx);
      await repo.insertMany([row(a), row(a, { rowId: 'repo-0000002' })]);
      await tx`update kpi_report set created_at = '2031-10-09T05:00:00Z' where row_id = 'repo-0000001'`;
      await tx`update kpi_report set created_at = '2031-10-10T05:00:00Z' where row_id = 'repo-0000002'`;
      const [s] = await repo.summaryByKenh(a, range('2031-10-09', '2031-10-10'));
      expect(s).toMatchObject({ kenh: 'Chăm sóc KH', count: 2, total: 13000, distinctAmounts: 2 });
    });
  });

  it('summaryByKenh, listMine chỉ trả dòng của userId đã cho', async () => {
    await inRollback(adminSql(), async (tx) => {
      await tx`set local session_replication_role = replica`;
      const [a, b] = await twoUsers(tx);
      const repo = new KpiReportRepository(tx);
      await repo.insertMany([row(a), row(b, { rowId: 'repo-0000002' })]);
      await tx`update kpi_report set created_at = '2031-05-05T05:00:00Z' where row_id like 'repo-%'`;
      const r = range('2031-01-01', '2031-12-31');
      expect((await repo.summaryByKenh(a, r))[0]!.count).toBe(1);
      expect(await repo.listMine(a, r)).toHaveLength(1);
      expect((await repo.listMine(b, r))[0]!.ticket).toBe('TICKET/1');
    });
  });

  it('row_id của A, B chèn cùng row_id → []; listMine(B) rỗng, dòng vẫn của A', async () => {
    await inRollback(adminSql(), async (tx) => {
      await tx`set local session_replication_role = replica`;
      const [a, b] = await twoUsers(tx);
      const repo = new KpiReportRepository(tx);
      const r = range('2031-01-01', '2031-12-31');
      await repo.insertMany([row(a)]);
      await tx`update kpi_report set created_at = '2031-05-05T05:00:00Z' where row_id = 'repo-0000001'`;
      expect(await repo.insertMany([row(b)])).toEqual([]);
      expect(await repo.listMine(a, r)).toHaveLength(1);
      expect(await repo.listMine(b, r)).toEqual([]);
      const [d] = await tx<{ user_id: string }[]>`select user_id from kpi_report where row_id = 'repo-0000001'`;
      expect(d!.user_id).toBe(a);
    });
  });

  it('hai transaction song song cùng row_id: một bên [rowId], bên kia [], DB 1 dòng', async () => {
    const rowId = 'par-00000001';
    const gate = deferred();
    const inserted = deferred();
    try {
      const [a] = await twoUsers(appSql());
      const t1 = appSql().begin(async (tx) => {
        const out = await new KpiReportRepository(tx as unknown as Sql).insertMany([row(a, { rowId })]);
        inserted.resolve();
        await gate.promise; // giữ transaction mở
        return out;
      });
      await inserted.promise;
      let t2Done = false;
      const t2 = appSql()
        .begin((tx) => new KpiReportRepository(tx as unknown as Sql).insertMany([row(a, { rowId })]))
        .finally(() => (t2Done = true));
      await new Promise((r) => setTimeout(r, 300));
      expect(t2Done).toBe(false); // t2 bị chặn chờ t1 commit
      gate.resolve();
      expect([await t1, await t2]).toEqual([[rowId], []]);
      const [c] = await appSql()<{ n: string }[]>`select count(*) as n from kpi_report where row_id = ${rowId}`;
      expect(Number(c!.n)).toBe(1);
    } finally {
      gate.resolve();
      await adminSql().begin(async (tx) => {
        await tx`set local session_replication_role = replica`; // bỏ trigger chặn xóa cứng
        await tx`delete from kpi_report where row_id = ${rowId}`;
      });
    }
  });
});

describe('KpiRateRepository', () => {
  it('upsertVersion hôm nay hai lần: một phiên bản hôm nay với giá lần 2; todayRates trả giá đó', async () => {
    await inRollback(appSql(), async (tx) => {
      const [a] = await twoUsers(tx);
      const repo = new KpiRateRepository(tx);
      const [t] = await tx<{ d: string }[]>`select (now() at time zone 'Asia/Ho_Chi_Minh')::date::text as d`;
      const d = t!.d;
      const today = d as never;
      const all = (n: number) => Object.fromEntries(KENH.map((k) => [k, n]));
      await repo.upsertVersion(today, all(1111), a);
      await repo.upsertVersion(today, all(2222), a);
      const versions = (await repo.listVersions()).filter((v) => v.from === d);
      expect(versions).toHaveLength(1);
      expect(Object.values(versions[0]!.rates)).toEqual(Array(11).fill(2222));
      expect(await repo.findVersion(today)).toEqual(versions[0]!.rates);
      expect(Object.values(await repo.todayRates())).toEqual(Array(11).fill(2222));
    });
  });

  it('findVersion trả null khi chưa có; listVersions cũ trước', async () => {
    const repo = new KpiRateRepository(appSql());
    expect(await repo.findVersion('1999-01-01' as never)).toBeNull();
    expect((await repo.listVersions())[0]!.from).toBe('2000-01-01');
  });
});
