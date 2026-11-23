import type { KpiRange } from '@ts24-htkh/shared';
import type { Sql } from '../client';

/** Khoảng [from, to] theo ngày VN; dùng được index theo created_at. */
export function createdAtInRange(sql: Sql, r: KpiRange) {
  return sql`
    created_at >= (${r.from}::date::timestamp at time zone 'Asia/Ho_Chi_Minh')
    and created_at < ((${r.to}::date + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh')`;
}
