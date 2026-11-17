import { createSql, type Sql } from '../client';

const APP_URL = 'postgresql://ts24_app:ts24_app_dev@127.0.0.1:54322/postgres';
const ADMIN_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

let app: Sql | undefined;
let admin: Sql | undefined;

export function appSql(): Sql {
  app ??= createSql(process.env.DATABASE_URL ?? APP_URL);
  return app;
}

/** Chỉ dùng cho test quyền và check:rls. */
export function adminSql(): Sql {
  admin ??= createSql(process.env.DATABASE_ADMIN_URL ?? ADMIN_URL);
  return admin;
}

class Rollback extends Error {}

/** Chạy fn trong transaction rồi luôn rollback, để các test không ghi chồng nhau. */
export async function inRollback(sql: Sql, fn: (tx: Sql) => Promise<void>): Promise<void> {
  try {
    await sql.begin(async (tx) => {
      await fn(tx as unknown as Sql);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
}
