import type { KpiRange } from '@ts24-htkh/shared';
import { afterAll, describe, expect, it } from 'vitest';
import type { Sql } from '../client';
import { adminSql, inRollback } from '../test/db';
import { KpiReportRepository, type NewKpiReport } from './kpi-report.repository';
import { ReconcileRepository } from './reconcile.repository';

afterAll(async () => {
  await adminSql().end();
});

const R = { from: '2031-10-05', to: '2031-10-05' } as KpiRange;

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

async function put(tx: Sql, rows: [NewKpiReport, string][]) {
  await new KpiReportRepository(tx).insertMany(rows.map(([r]) => r));
  for (const [r, at] of rows) await tx`update kpi_report set created_at = ${at} where row_id = ${r.rowId}`;
}

describe('ReconcileRepository', () => {
  it('lines bỏ dòng xóa mềm và ngoài khoảng; biên 00:00 và 23:59 giờ VN', async () => {
    await inRollback(adminSql(), async (tx) => {
      await tx`set local session_replication_role = replica`;
      const [u] = await tx<{ id: string }[]>`select id from app_user where deleted_at is null order by created_at limit 1`;
      const a = u!.id;
      await put(tx, [
        [row(a, 'rc-0000001', { ticket: 'TICKET/1' }), '2031-10-04T17:00:00Z'], // 00:00 ngày 05 VN
        [row(a, 'rc-0000002', { ticket: 'TICKET/2' }), '2031-10-05T16:59:59Z'], // 23:59:59 ngày 05 VN
        [row(a, 'rc-0000003', { ticket: 'TICKET/3' }), '2031-10-04T16:59:59Z'], // ngoài (04 VN)
        [row(a, 'rc-0000004', { ticket: 'TICKET/4' }), '2031-10-05T16:00:00Z'], // 23:00 VN, bị xóa mềm
        [row(a, 'rc-0000005', { ticket: 'TICKET/5' }), '2031-10-05T17:00:00Z'], // ngoài (06 VN)
      ]);
      await tx`update kpi_report set deleted_at = now(), delete_reason = 'test' where row_id = 'rc-0000004'`;
      const lines = await new ReconcileRepository(tx).lines(R);
      expect(lines.map((l) => l.ticket)).toEqual(['TICKET/1', 'TICKET/2']);
      expect(lines[0]).toMatchObject({ userId: a, fullName: 'Tên', teamId: null, kenh: 'Chăm sóc KH' });
      for (const l of lines) expect(l.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(lines[0]!.createdAt).toBe('2031-10-04T17:00:00.000Z');
    });
  });

  it('users có tài khoản khóa và đã xóa mềm, inactive đúng', async () => {
    await inRollback(adminSql(), async (tx) => {
      await tx`set local session_replication_role = replica`;
      const us = await tx<{ id: string }[]>`select id from app_user where role <> 'head' and deleted_at is null order by created_at limit 2`;
      await tx`update app_user set status = 'locked' where id = ${us[0]!.id}`;
      await tx`update app_user set deleted_at = now() where id = ${us[1]!.id}`;
      const users = await new ReconcileRepository(tx).users();
      const by = new Map(users.map((u) => [u.id, u]));
      expect(by.get(us[0]!.id)!.inactive).toBe(true);
      expect(by.get(us[1]!.id)!.inactive).toBe(true);
      expect(users.some((u) => !u.inactive)).toBe(true);
      expect(users.filter((u) => u.role === 'head').every((u) => !u.inactive)).toBe(true);
    });
  });
});
