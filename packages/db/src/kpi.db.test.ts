import { DEFAULT_KPI_RATES, KENH, PHAN_LOAI } from '@ts24-htkh/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { relationsGrantedToClientRoles, tablesWithoutRls } from './check-rls';
import type { Sql } from './client';
import { adminSql, appSql, inRollback } from './test/db';

afterAll(async () => {
  await appSql().end();
  await adminSql().end();
});

type Row = Partial<{
  rowId: string;
  ticket: string;
  kenh: string;
  phanLoai: string;
  noiDung: string;
}>;

async function insertReport(tx: Sql, r: Row = {}) {
  const [u] = await tx<{ id: string }[]>`select id from app_user where role = 'head' and deleted_at is null`;
  const [row] = await tx<{ id: string }[]>`
    insert into kpi_report (row_id, user_id, full_name, team_id, ticket, kenh, phan_loai, noi_dung)
    values (${r.rowId ?? 'row-00000001'}, ${u!.id}, 'Trưởng phòng', null, ${r.ticket ?? 'TICKET/123'},
      ${r.kenh ?? 'PI Hoàn Thành'}, ${r.phanLoai ?? 'Hỗ trợ sử dụng'}, ${r.noiDung ?? 'Nội dung'})
    returning id`;
  return row!.id;
}

describe('kpi_rate', () => {
  it('có bản mặc định 2000-01-01 đủ 11 kênh với đúng giá spec', async () => {
    const rows = await appSql()<{ kenh: string; amount: number }[]>`
      select kenh, amount from kpi_rate where effective_from = '2000-01-01'`;
    expect(rows).toHaveLength(11);
    expect(Object.fromEntries(rows.map((r) => [r.kenh, r.amount]))).toEqual(DEFAULT_KPI_RATES);
  });

  it('chặn insert effective_from hôm qua và chặn xóa dòng', async () => {
    await inRollback(appSql(), async (tx) => {
      await expect(
        tx`insert into kpi_rate (effective_from, kenh, amount)
           values ((now() at time zone 'Asia/Ho_Chi_Minh')::date - 1, 'PI Hoàn Thành', 1)`,
      ).rejects.toThrow(/kpi_rate/);
    });
    await inRollback(adminSql(), async (tx) => {
      // admin cũng bị trigger chặn, không chỉ vì thiếu grant
      await expect(tx`delete from kpi_rate where effective_from = '2000-01-01'`).rejects.toThrow(/kpi_rate/);
    });
  });

  it('insert hôm nay rồi on conflict do update cùng ngày thì được', async () => {
    await inRollback(appSql(), async (tx) => {
      const up = (amount: number) => tx`
        insert into kpi_rate (effective_from, kenh, amount)
        values ((now() at time zone 'Asia/Ho_Chi_Minh')::date, 'PI Hoàn Thành', ${amount})
        on conflict (effective_from, kenh) do update set amount = excluded.amount`;
      await up(1111);
      await up(2222);
      const [r] = await tx<{ amount: number }[]>`
        select amount from kpi_rate
        where effective_from = (now() at time zone 'Asia/Ho_Chi_Minh')::date and kenh = 'PI Hoàn Thành'`;
      expect(r!.amount).toBe(2222);
    });
  });
});

describe('kpi_rate (quyền)', () => {
  it('ts24_app không sửa được dòng đơn giá của ngày đã qua', async () => {
    await inRollback(appSql(), async (tx) => {
      await expect(tx`update kpi_rate set amount = 1 where effective_from = '2000-01-01'`).rejects.toThrow(/kpi_rate/);
    });
  });
});

describe('danh mục DB khớp shared', () => {
  const listed = async (table: string, column: string) => {
    const defs = await adminSql()<{ def: string }[]>`
      select pg_get_constraintdef(c.oid) as def from pg_constraint c
      where c.conrelid = ${`public.${table}`}::regclass and c.contype = 'c'
        and pg_get_constraintdef(c.oid) like ${`%${column}%ARRAY%`}`;
    expect(defs).toHaveLength(1);
    return [...defs[0]!.def.matchAll(/'((?:[^']|'')*)'::text/g)].map((m) => m[1]!.replaceAll("''", "'"));
  };

  it('kenh (kpi_report, kpi_rate) và phan_loai đúng danh sách, đúng thứ tự', async () => {
    expect(await listed('kpi_report', 'kenh')).toEqual([...KENH]);
    expect(await listed('kpi_rate', 'kenh')).toEqual([...KENH]);
    expect(await listed('kpi_report', 'phan_loai')).toEqual([...PHAN_LOAI]);
  });
});

describe('kpi_report', () => {
  const bad: [string, Row][] = [
    ['ticket sai dạng', { ticket: 'TK/12' }],
    ['kênh ngoài danh mục', { kenh: 'Kênh lạ' }],
    ['phân loại ngoài danh mục', { phanLoai: 'Khác' }],
    ['nội dung rỗng', { noiDung: '' }],
    ['nội dung 1001 ký tự', { noiDung: 'a'.repeat(1001) }],
    ["row_id 'short'", { rowId: 'short' }],
  ];
  it.each(bad)('từ chối %s', async (_ten, row) => {
    await inRollback(appSql(), async (tx) => {
      await expect(insertReport(tx, row)).rejects.toThrow();
    });
  });

  it('nhận nội dung đúng 1000 ký tự', async () => {
    await inRollback(appSql(), async (tx) => {
      await insertReport(tx, { noiDung: 'a'.repeat(1000) });
    });
  });

  it('row_id trùng bị từ chối kể cả khi dòng cũ đã xóa mềm', async () => {
    await inRollback(appSql(), async (tx) => {
      const id = await insertReport(tx);
      const [u] = await tx<{ id: string }[]>`select id from app_user where role = 'head'`;
      await tx`update kpi_report set deleted_at = now(), deleted_by = ${u!.id}, delete_reason = 'thử' where id = ${id}`;
      await expect(insertReport(tx)).rejects.toMatchObject({ code: '23505' });
    });
  });

  it('không sửa được ticket, không xóa cứng được', async () => {
    await inRollback(appSql(), async (tx) => {
      const id = await insertReport(tx);
      await expect(tx`update kpi_report set ticket = 'TICKET/999' where id = ${id}`).rejects.toThrow(/kpi_report/);
    });
    await inRollback(adminSql(), async (tx) => {
      // admin: trigger chặn xóa cứng, không chỉ vì thiếu grant
      const id = await insertReport(tx);
      await expect(tx`delete from kpi_report where id = ${id}`).rejects.toThrow(/kpi_report/);
    });
  });

  it('sửa deleted_at + delete_reason + deleted_by thì được', async () => {
    await inRollback(appSql(), async (tx) => {
      const id = await insertReport(tx);
      const [u] = await tx<{ id: string }[]>`select id from app_user where role = 'head'`;
      await tx`update kpi_report set deleted_at = now(), deleted_by = ${u!.id}, delete_reason = 'nhập nhầm' where id = ${id}`;
      const [r] = await tx<{ delete_reason: string }[]>`select delete_reason from kpi_report where id = ${id}`;
      expect(r!.delete_reason).toBe('nhập nhầm');
    });
  });

  it('đặt deleted_at mà không có lý do thì lỗi', async () => {
    await inRollback(appSql(), async (tx) => {
      const id = await insertReport(tx);
      await expect(tx`update kpi_report set deleted_at = now() where id = ${id}`).rejects.toThrow();
    });
  });
});

describe('kpi_report_priced', () => {
  it('ts24_app đọc được view', async () => {
    await expect(appSql()`select count(*) from kpi_report_priced`).resolves.toHaveLength(1);
  });

  it('chọn giá theo ngày gửi giờ VN', async () => {
    await inRollback(adminSql(), async (tx) => {
      await tx`set local session_replication_role = replica`; // bỏ qua trigger chặn ngày quá khứ
      await tx`insert into kpi_rate (effective_from, kenh, amount) values ('2026-10-10', 'Chăm sóc KH', 7000)`;
      const [u] = await tx<{ id: string }[]>`select id from app_user where role = 'head'`;
      const ins = (rowId: string, at: string) => tx`
        insert into kpi_report (row_id, user_id, full_name, ticket, kenh, phan_loai, noi_dung, created_at)
        values (${rowId}, ${u!.id}, 'TP', 'TICKET/1', 'Chăm sóc KH', 'Hỗ trợ sử dụng', 'x', ${at})`;
      await ins('view-0000001', '2026-10-09T16:30:00Z');
      await ins('view-0000002', '2026-10-09T17:30:00Z');
      const rows = await tx<{ row_id: string; report_date: string; amount: number }[]>`
        select row_id, report_date::text as report_date, amount from kpi_report_priced
        where row_id like 'view-%' order by row_id`;
      expect(rows.map((r) => [r.report_date, r.amount])).toEqual([
        ['2026-10-09', 5000],
        ['2026-10-10', 7000],
      ]);
    });
  });
});

describe('check:rls với kpi', () => {
  it('bảng có RLS và không cấp quyền cho anon/authenticated', async () => {
    const noRls = await tablesWithoutRls(adminSql());
    expect(noRls).not.toContain('kpi_report');
    expect(noRls).not.toContain('kpi_rate');
    const granted = await relationsGrantedToClientRoles(adminSql());
    for (const n of ['kpi_report', 'kpi_rate', 'kpi_report_priced']) expect(granted).not.toContain(n);
  });
});
