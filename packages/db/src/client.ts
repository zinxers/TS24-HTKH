import postgres from 'postgres';

export type Sql = postgres.Sql;

// prepare: false để chạy được qua pooler (Supavisor transaction mode).
export function createSql(url: string): Sql {
  return postgres(url, { prepare: false });
}
