import type { UserRow } from '@ts24-htkh/db';
import type { CurrentUser, Role } from '@ts24-htkh/shared';

export interface LoginResult {
  token: string;
  user: CurrentUser;
}

export function toCurrentUser(row: UserRow): CurrentUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    // DB có check constraint role in ('head','manager','staff').
    role: row.role as Role,
    teamId: row.team_id,
  };
}
