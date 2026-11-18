import type { Sql } from '../client';
import type { UserRow } from './user.repository';

export interface SessionWithUser {
  sessionId: string;
  expiresAt: string;
  user: UserRow;
}

/** Bảng user_session: dữ liệu tạm, không xóa mềm, xóa hẳn dòng. */
export class SessionRepository {
  constructor(private readonly sql: Sql) {}

  async create(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.sql`
      insert into user_session (user_id, token_hash, expires_at)
      values (${userId}, ${tokenHash}, ${expiresAt})`;
  }

  async findActiveWithUser(tokenHash: string): Promise<SessionWithUser | null> {
    const [row] = await this.sql<({ session_id: string; session_expires_at: string } & UserRow)[]>`
      select s.id as session_id, s.expires_at as session_expires_at,
        u.id, u.email, u.full_name, u.role, u.team_id, u.status, u.failed_login_count, u.login_blocked_until,
        u.created_at, u.updated_at, u.deleted_at, u.deleted_by
      from user_session s
      join app_user u on u.id = s.user_id
      where s.token_hash = ${tokenHash} and s.expires_at > now() and u.deleted_at is null`;
    if (!row) return null;
    const { session_id, session_expires_at, ...user } = row;
    return { sessionId: session_id, expiresAt: session_expires_at, user };
  }

  async extend(sessionId: string, expiresAt: Date): Promise<void> {
    await this.sql`update user_session set expires_at = ${expiresAt} where id = ${sessionId}`;
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    await this.sql`delete from user_session where token_hash = ${tokenHash}`;
  }

  async deleteByUser(userId: string): Promise<void> {
    await this.sql`delete from user_session where user_id = ${userId}`;
  }

  async deleteExpiredByUser(userId: string): Promise<void> {
    await this.sql`delete from user_session where user_id = ${userId} and expires_at <= now()`;
  }
}
