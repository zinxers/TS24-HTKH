import type { UserRow } from '@ts24-htkh/db';
import type { AccountStatus, AccountView, Role } from '@ts24-htkh/shared';
import type { AccountTarget } from '../../policies/permissions';

/** Chọn trường tường minh: không bao giờ chép password_hash hay trường nội bộ ra ngoài. */
export function toAccountView(row: UserRow, teamName: string | null): AccountView {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    // DB có check constraint cho role và status.
    role: row.role as Role,
    teamId: row.team_id,
    teamName,
    status: row.status as AccountStatus,
    createdAt: row.created_at,
  };
}

export function toTarget(row: UserRow): AccountTarget {
  return { id: row.id, role: row.role as Role, teamId: row.team_id };
}
