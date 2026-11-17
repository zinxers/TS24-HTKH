import postgres from 'postgres';

export type Sql = postgres.Sql;

// timestamptz (oid 1184) trả về chuỗi ISO 8601 thay vì Date, khớp types.generated.ts.
const isoTimestamp = {
  to: 1184,
  from: [1184],
  serialize: (x: unknown) => (x instanceof Date ? x.toISOString() : String(x)),
  parse: (x: string) => new Date(x).toISOString(),
};

// prepare: false để chạy được qua pooler (Supavisor transaction mode).
export function createSql(url: string): Sql {
  return postgres(url, { prepare: false, types: { isoTimestamp } }) as unknown as Sql;
}
