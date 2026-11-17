import { afterAll, describe, expect, it } from 'vitest';
import { relationsGrantedToClientRoles, tablesWithoutRls } from './check-rls';
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

describe('relationsGrantedToClientRoles', () => {
  it('schema hiện tại sạch', async () => {
    expect(await relationsGrantedToClientRoles(adminSql())).toEqual([]);
  });

  it('báo bảng có RLS nhưng anon còn quyền truncate', async () => {
    await inRollback(adminSql(), async (tx) => {
      await tx`create table public.tam_co_rls (id int)`;
      await tx`alter table public.tam_co_rls enable row level security`;
      await tx`grant truncate on public.tam_co_rls to anon`;
      expect(await tablesWithoutRls(tx)).toEqual([]);
      expect(await relationsGrantedToClientRoles(tx)).toEqual(['tam_co_rls']);
    });
  });

  it('báo view mà authenticated đọc được', async () => {
    await inRollback(adminSql(), async (tx) => {
      await tx`create view public.tam_view as select id, email from public.app_user`;
      await tx`grant select on public.tam_view to authenticated`;
      expect(await relationsGrantedToClientRoles(tx)).toEqual(['tam_view']);
    });
  });
});

describe('quyền mặc định cho object mới trong public', () => {
  it('bảng, view, hàm mới do postgres tạo không cấp cho anon, authenticated', async () => {
    await inRollback(adminSql(), async (tx) => {
      await tx`create table public.tam_moi (id int)`;
      await tx`create view public.tam_view_moi as select 1 as x`;
      await tx`create function public.tam_ham_moi() returns int language sql as 'select 1'`;
      const [row] = await tx<{ table: boolean; view: boolean; fn: boolean }[]>`
        select
          has_table_privilege('anon', 'public.tam_moi', 'select, insert, update, delete, truncate')
            or has_table_privilege('authenticated', 'public.tam_moi', 'select, insert, update, delete, truncate') as table,
          has_table_privilege('anon', 'public.tam_view_moi', 'select')
            or has_table_privilege('authenticated', 'public.tam_view_moi', 'select') as view,
          has_function_privilege('anon', 'public.tam_ham_moi()', 'execute')
            or has_function_privilege('authenticated', 'public.tam_ham_moi()', 'execute') as fn`;
      expect(row).toEqual({ table: false, view: false, fn: false });
    });
  });

  it('hàm trigger hiện có không cho anon, authenticated execute', async () => {
    const rows = await adminSql()<{ proname: string }[]>`
      select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and (has_function_privilege('anon', p.oid, 'execute')
          or has_function_privilege('authenticated', p.oid, 'execute'))
      order by p.proname`;
    expect(rows.map((r) => r.proname)).toEqual([]);
  });
});
