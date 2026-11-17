// Chạy: node scripts/check-rls.ts. Thoát mã 1 nếu có bảng public chưa bật RLS.
import { tablesWithoutRls } from '../src/check-rls.ts';
import { createSql } from '../src/client.ts';

const url = process.env.DATABASE_ADMIN_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const sql = createSql(url);

try {
  const tables = await tablesWithoutRls(sql);
  for (const table of tables) console.error(`Bảng chưa bật RLS: public.${table}`);
  if (tables.length > 0) process.exitCode = 1;
  else console.log('check:rls: mọi bảng public đã bật RLS.');
} finally {
  await sql.end();
}
