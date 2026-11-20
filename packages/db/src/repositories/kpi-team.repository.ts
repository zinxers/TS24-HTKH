import type { KpiRange } from '@ts24-htkh/shared';
import type { Sql } from '../client';
import { createdAtInRange } from './kpi-range';
import type { KpiItemRow } from './kpi-report.repository';

/** Chỉ đọc view kpi_report_priced, gom theo team_id chụp lúc gửi; `null` = dòng không thuộc team. */
export class KpiTeamRepository {
  constructor(private readonly sql: Sql) {}

  private inTeam(teamId: string | null) {
    return teamId === null ? this.sql`team_id is null` : this.sql`team_id = ${teamId}`;
  }

  async teamCells(
    teamId: string | null,
    range: KpiRange,
  ): Promise<{ userId: string; kenh: string; phanLoai: string; count: number; money: number }[]> {
    const rows = await this.sql<{ user_id: string; kenh: string; phan_loai: string; count: string; money: string }[]>`
      select user_id, kenh, phan_loai, count(*) as count, sum(amount) as money
      from kpi_report_priced
      where ${this.inTeam(teamId)} and ${createdAtInRange(this.sql, range)}
      group by user_id, kenh, phan_loai`;
    return rows.map((r) => ({
      userId: r.user_id,
      kenh: r.kenh,
      phanLoai: r.phan_loai,
      count: Number(r.count),
      money: Number(r.money),
    }));
  }

  async latestNames(teamId: string | null, range: KpiRange): Promise<{ userId: string; fullName: string }[]> {
    const rows = await this.sql<{ user_id: string; full_name: string }[]>`
      select distinct on (user_id) user_id, full_name
      from kpi_report_priced
      where ${this.inTeam(teamId)} and ${createdAtInRange(this.sql, range)}
      order by user_id, created_at desc, id desc`;
    return rows.map((r) => ({ userId: r.user_id, fullName: r.full_name }));
  }

  /** Số ngày VN có báo cáo, tính mọi team. */
  async daysByUser(userIds: string[], range: KpiRange): Promise<{ userId: string; days: number }[]> {
    if (userIds.length === 0) return [];
    const rows = await this.sql<{ user_id: string; days: string }[]>`
      select user_id, count(distinct report_date) as days
      from kpi_report_priced
      where user_id = any(${userIds}::uuid[]) and ${createdAtInRange(this.sql, range)}
      group by user_id`;
    return rows.map((r) => ({ userId: r.user_id, days: Number(r.days) }));
  }

  async teamItems(teamId: string, userId: string, range: KpiRange): Promise<KpiItemRow[]> {
    return this.sql<KpiItemRow[]>`
      select created_at, ticket, kenh, phan_loai, noi_dung, amount from kpi_report_priced
      where team_id = ${teamId} and user_id = ${userId} and ${createdAtInRange(this.sql, range)}
      order by created_at desc, id desc`;
  }

  async countByTeam(range: KpiRange): Promise<{ teamId: string | null; count: number }[]> {
    const rows = await this.sql<{ team_id: string | null; count: string }[]>`
      select team_id, count(*) as count from kpi_report_priced
      where ${createdAtInRange(this.sql, range)}
      group by team_id`;
    return rows.map((r) => ({ teamId: r.team_id, count: Number(r.count) }));
  }

  /** Một câu cho mọi kỳ; `index` là vị trí kỳ trong `periods`. */
  async trend(
    periods: KpiRange[],
    team: string | 'all',
  ): Promise<{ index: number; teamId: string | null; count: number; money: number }[]> {
    if (periods.length === 0) return [];
    const froms = periods.map((p) => p.from as string);
    const tos = periods.map((p) => p.to as string);
    const teamFilter = team === 'all' ? this.sql`true` : this.sql`v.team_id = ${team}`;
    const rows = await this.sql<{ i: string; team_id: string | null; count: string; money: string }[]>`
      select p.i, v.team_id, count(*) as count, sum(v.amount) as money
      from unnest(${froms}::date[], ${tos}::date[]) with ordinality as p(f, t, i)
      join kpi_report_priced v
        on v.created_at >= (p.f::timestamp at time zone 'Asia/Ho_Chi_Minh')
       and v.created_at < ((p.t + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh')
      where ${teamFilter}
      group by p.i, v.team_id`;
    return rows.map((r) => ({ index: Number(r.i) - 1, teamId: r.team_id, count: Number(r.count), money: Number(r.money) }));
  }
}
