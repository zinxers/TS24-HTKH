import type { Sql } from './client';

// Không import 'server-only': file này chạy trực tiếp bằng node trong scripts/check-rls.ts.
/** Bảng trong schema public chưa bật RLS, sắp theo tên. */
export async function tablesWithoutRls(sql: Sql): Promise<string[]> {
  const rows = await sql<{ tablename: string }[]>`
    select tablename from pg_tables
    where schemaname = 'public' and rowsecurity = false
    order by tablename`;
  return rows.map((r) => r.tablename);
}

/**
 * Bảng, view, materialized view trong public mà anon hoặc authenticated có bất kỳ quyền nào.
 * RLS không chặn TRUNCATE, và view chạy bằng quyền chủ sở hữu, nên chỉ kiểm RLS là chưa đủ.
 */
export async function relationsGrantedToClientRoles(sql: Sql): Promise<string[]> {
  const rows = await sql<{ relname: string }[]>`
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and exists (
        select from unnest(array['anon', 'authenticated']) as r(role)
        where has_table_privilege(r.role, c.oid,
          'select, insert, update, delete, truncate, references, trigger'))
    order by c.relname`;
  return rows.map((r) => r.relname);
}
