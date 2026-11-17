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
