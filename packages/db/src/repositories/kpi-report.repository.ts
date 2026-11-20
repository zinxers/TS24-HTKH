import type { IsoDate, KpiRange } from '@ts24-htkh/shared';
import type { Sql } from '../client';
import type { Database } from '../types.generated';
import { createdAtInRange } from './kpi-range';

export interface NewKpiReport {
  rowId: string;
  userId: string;
  fullName: string;
  teamId: string | null;
  ticket: string;
  kenh: string;
  phanLoai: string;
  noiDung: string;
}

export type KpiItemRow = Pick<
  Database['public']['Views']['kpi_report_priced']['Row'],
  'created_at' | 'ticket' | 'kenh' | 'phan_loai' | 'noi_dung' | 'amount'
>;

export interface KenhSummary {
  kenh: string;
  count: number;
  total: number;
  distinctAmounts: number;
  amount: number;
}

/** Chỉ đọc/ghi kpi_report; mọi câu đọc đi qua view kpi_report_priced (đã bỏ dòng xóa mềm). */
export class KpiReportRepository {
  constructor(private readonly sql: Sql) {}

  private inRange(r: KpiRange) {
    return createdAtInRange(this.sql, r);
  }

  /** Trả row_id thật sự được tạo; row_id đã có (của ai cũng vậy) bị bỏ qua. */
  async insertMany(rows: NewKpiReport[]): Promise<string[]> {
    if (rows.length === 0) return [];
    const values = rows.map((r) => [r.rowId, r.userId, r.fullName, r.teamId, r.ticket, r.kenh, r.phanLoai, r.noiDung]);
    const out = await this.sql<{ row_id: string }[]>`
      insert into kpi_report (row_id, user_id, full_name, team_id, ticket, kenh, phan_loai, noi_dung)
      select * from unnest(
        ${values.map((v) => v[0]) as string[]}::text[], ${values.map((v) => v[1]) as string[]}::uuid[],
        ${values.map((v) => v[2]) as string[]}::text[], ${values.map((v) => v[3]) as string[]}::uuid[],
        ${values.map((v) => v[4]) as string[]}::text[], ${values.map((v) => v[5]) as string[]}::text[],
        ${values.map((v) => v[6]) as string[]}::text[], ${values.map((v) => v[7]) as string[]}::text[])
      on conflict (row_id) do nothing
      returning row_id`;
    return out.map((r) => r.row_id);
  }

  async summaryByKenh(userId: string, range: KpiRange): Promise<KenhSummary[]> {
    const rows = await this.sql<{ kenh: string; count: string; total: string; distinct_amounts: string; amount: number }[]>`
      select kenh, count(*) as count, sum(amount) as total,
             count(distinct amount) as distinct_amounts, min(amount) as amount
      from kpi_report_priced
      where user_id = ${userId} and ${this.inRange(range)}
      group by kenh`;
    return rows.map((r) => ({
      kenh: r.kenh,
      count: Number(r.count),
      total: Number(r.total),
      distinctAmounts: Number(r.distinct_amounts),
      amount: r.amount,
    }));
  }

  async countByPhanLoai(userId: string, range: KpiRange): Promise<{ phanLoai: string; count: number }[]> {
    const rows = await this.sql<{ phan_loai: string; count: string }[]>`
      select phan_loai, count(*) as count from kpi_report_priced
      where user_id = ${userId} and ${this.inRange(range)}
      group by phan_loai`;
    return rows.map((r) => ({ phanLoai: r.phan_loai, count: Number(r.count) }));
  }

  async countByDay(userId: string, range: KpiRange): Promise<{ date: IsoDate; count: number }[]> {
    const rows = await this.sql<{ date: string; count: string }[]>`
      select report_date::text as date, count(*) as count from kpi_report_priced
      where user_id = ${userId} and ${this.inRange(range)}
      group by report_date order by report_date`;
    return rows.map((r) => ({ date: r.date as IsoDate, count: Number(r.count) }));
  }

  async listMine(userId: string, range: KpiRange): Promise<KpiItemRow[]> {
    return this.sql<KpiItemRow[]>`
      select created_at, ticket, kenh, phan_loai, noi_dung, amount from kpi_report_priced
      where user_id = ${userId} and ${this.inRange(range)}
      order by created_at desc, id desc`;
  }
}
