import { afterAll, describe, expect, it } from 'vitest';
import { tablesWithoutRls } from './check-rls';
import { adminSql, inRollback } from './test/db';

afterAll(async () => {
  await adminSql().end();
});

describe('tablesWithoutRls', () => {
  it('schema hiện tại sạch', async () => {
    expect(await tablesWithoutRls(adminSql())).toEqual([]);
  });

  it('báo bảng chưa bật RLS, hết báo khi bật', async () => {
    await inRollback(adminSql(), async (tx) => {
      await tx`create table public.tam_khong_rls (id int)`;
      expect(await tablesWithoutRls(tx)).toEqual(['tam_khong_rls']);
      await tx`alter table public.tam_khong_rls enable row level security`;
      expect(await tablesWithoutRls(tx)).toEqual([]);
    });
  });
});
