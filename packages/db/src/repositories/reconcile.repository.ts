import type { KpiRange, Role } from '@ts24-htkh/shared';
import type { Sql } from '../client';
import { createdAtInRange } from './kpi-range';

export interface ReconcileLine {
  userId: string;
  fullName: string;
  teamId: string | null;
  ticket: string;
  kenh: string;
  /** ISO 8601 UTC, đủ mili giây (cùng một dạng cho mọi dòng để so sánh chuỗi). */
  createdAt: string;
}

export interface ReconcileUser {
  id: string;
  fullName: string;
  role: Role;
  teamId: string | null;
  inactive: boolean;
}

/** Đọc dữ liệu cho đối soát KPI; chỉ đọc. */
export class ReconcileRepository {
  constructor(private readonly sql: Sql) {}

  /** kpi_report chưa xóa mềm trong khoảng ngày VN, theo thời gian tạo. */
  async lines(range: KpiRange): Promise<ReconcileLine[]> {
    return this.sql<ReconcileLine[]>`
      select user_id as "userId", full_name as "fullName", team_id as "teamId", ticket, kenh,
             created_at as "createdAt"
      from kpi_report
      where deleted_at is null and ${createdAtInRange(this.sql, range)}
      order by created_at, id`;
  }

  /** Mọi app_user; inactive = bị khóa hoặc xóa mềm. */
  async users(): Promise<ReconcileUser[]> {
    return this.sql<ReconcileUser[]>`
      select id, full_name as "fullName", role, team_id as "teamId",
             (status = 'locked' or deleted_at is not null) as inactive
      from app_user`;
  }
}
