import type postgres from 'postgres';
import type { Sql } from '../client';

/** Ngày VN dạng giá trị (`KpiRange`) hoặc biểu thức SQL kiểu date (vd cột `p.f` của unnest). */
type DayBound = string | postgres.Fragment;

/** Khoảng [from, to] theo ngày VN; dùng được index theo created_at. */
export function createdAtInRange(sql: Sql, r: { from: DayBound; to: DayBound }) {
  return sql`
    created_at >= (${r.from}::date::timestamp at time zone 'Asia/Ho_Chi_Minh')
    and created_at < ((${r.to}::date + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh')`;
}
