import type { Sql } from '../client';
import type { Database } from '../types.generated';
import { BaseRepository } from './base.repository';

export type UserRow = Omit<Database['public']['Tables']['app_user']['Row'], 'password_hash'>;

export interface UserCredentials {
  id: string;
  passwordHash: string | null;
  status: string;
  failedLoginCount: number;
  loginBlockedUntil: string | null;
}

export interface FailedLoginResult {
  failedLoginCount: number;
  loginBlockedUntil: string | null;
}

const normalize = (email: string) => email.trim().toLowerCase();

export class UserRepository extends BaseRepository<UserRow> {
  constructor(sql: Sql) {
    super(sql, 'app_user');
  }

  /** Cột trả cho tầng trên: không có password_hash. */
  private columns() {
    return this.sql`
      id, email, full_name, role, team_id, status, failed_login_count, login_blocked_until,
      created_at, updated_at, deleted_at, deleted_by`;
  }

  override async findById(id: string): Promise<UserRow | null> {
    const [row] = await this.sql<UserRow[]>`
      select ${this.columns()} from app_user where id = ${id} and deleted_at is null`;
    return row ?? null;
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    const [row] = await this.sql<UserRow[]>`
      select ${this.columns()} from app_user where email = ${normalize(email)} and deleted_at is null`;
    return row ?? null;
  }

  async findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    const [row] = await this.sql<UserCredentials[]>`
      select id, password_hash as "passwordHash", status, failed_login_count as "failedLoginCount",
        login_blocked_until as "loginBlockedUntil"
      from app_user where email = ${normalize(email)} and deleted_at is null`;
    return row ?? null;
  }

  /** Tăng nguyên tử trong một câu: hai lần sai song song không mất lượt đếm. */
  async recordFailedLogin(id: string, threshold: number, blockSeconds: number): Promise<FailedLoginResult> {
    const [row] = await this.sql<FailedLoginResult[]>`
      update app_user
      set failed_login_count = failed_login_count + 1,
        login_blocked_until = case
          when failed_login_count + 1 >= ${threshold} then now() + make_interval(secs => ${blockSeconds})
          else login_blocked_until
        end
      where id = ${id}
      returning failed_login_count as "failedLoginCount", login_blocked_until as "loginBlockedUntil"`;
    return row!;
  }

  async resetFailedLogins(id: string): Promise<void> {
    await this.sql`
      update app_user set failed_login_count = 0, login_blocked_until = null where id = ${id}`;
  }

  async setPasswordHash(id: string, hash: string): Promise<void> {
    await this.sql`
      update app_user
      set password_hash = ${hash}, failed_login_count = 0, login_blocked_until = null
      where id = ${id}`;
  }
}
