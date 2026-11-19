import type { IsoDate } from '@ts24-htkh/shared';
import type { Sql } from '../client';

export interface RateVersionRow {
  from: IsoDate;
  rates: Record<string, number>;
  createdBy: string | null;
  createdAt: string;
}

/** Chỉ đọc/ghi kpi_rate. Chặn ngày quá khứ do trigger DB; luật "chỉ Trưởng phòng" nằm ở Policy. */
export class KpiRateRepository {
  constructor(private readonly sql: Sql) {}

  /** Gom theo effective_from, cũ trước. */
  async listVersions(): Promise<RateVersionRow[]> {
    const rows = await this.sql<
      { from: string; kenh: string; amount: number; created_by: string | null; created_at: string }[]
    >`select effective_from::text as "from", kenh, amount, created_by, created_at
      from kpi_rate order by effective_from, kenh`;
    const out = new Map<string, RateVersionRow>();
    for (const r of rows) {
      const v = out.get(r.from) ?? { from: r.from as IsoDate, rates: {}, createdBy: r.created_by, createdAt: r.created_at };
      v.rates[r.kenh] = r.amount;
      out.set(r.from, v);
    }
    return [...out.values()];
  }

  async findVersion(from: IsoDate): Promise<Record<string, number> | null> {
    const rows = await this.sql<{ kenh: string; amount: number }[]>`
      select kenh, amount from kpi_rate where effective_from = ${from}::date`;
    return rows.length === 0 ? null : Object.fromEntries(rows.map((r) => [r.kenh, r.amount]));
  }

  async upsertVersion(from: IsoDate, rates: Record<string, number>, actorId: string): Promise<void> {
    const kenh = Object.keys(rates);
    await this.sql`
      insert into kpi_rate (effective_from, kenh, amount, created_by)
      select ${from}::date, k, a, ${actorId}::uuid
      from unnest(${kenh}::text[], ${kenh.map((k) => rates[k]!)}::int[]) as t(k, a)
      on conflict (effective_from, kenh) do update
        set amount = excluded.amount, created_by = excluded.created_by`;
  }

  /** Phiên bản mới nhất có effective_from <= hôm nay (giờ VN). */
  async todayRates(): Promise<Record<string, number>> {
    const rows = await this.sql<{ kenh: string; amount: number }[]>`
      select kenh, amount from kpi_rate
      where effective_from = (
        select max(effective_from) from kpi_rate
        where effective_from <= (now() at time zone 'Asia/Ho_Chi_Minh')::date)`;
    return Object.fromEntries(rows.map((r) => [r.kenh, r.amount]));
  }
}
