import type { Role } from '@ts24-htkh/shared';
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

export type UserListRow = UserRow & { team_name: string | null };

export interface CreateUserInput {
  email: string;
  fullName: string;
  role: 'manager' | 'staff';
  teamId: string;
  passwordHash: string;
}

export interface UpdateUserPatch {
  fullName?: string;
  role?: Role;
  teamId?: string | null;
}

/** Email đã có tài khoản còn hoạt động (23505 trên ux_app_user_email). */
export class EmailTakenError extends Error {
  constructor() {
    super('Email đã có tài khoản');
    this.name = 'EmailTakenError';
  }
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

  /** Khóa hàng tới hết transaction: hai thao tác song song trên cùng đích chạy tuần tự. */
  async findByIdForUpdate(id: string): Promise<UserRow | null> {
    const [row] = await this.sql<UserRow[]>`
      select ${this.columns()} from app_user where id = ${id} and deleted_at is null for update`;
    return row ?? null;
  }

  async listActive(filter: { teamId?: string }): Promise<UserListRow[]> {
    const byTeam = filter.teamId === undefined ? this.sql`` : this.sql`and u.team_id = ${filter.teamId}`;
    return this.sql<UserListRow[]>`
      select u.id, u.email, u.full_name, u.role, u.team_id, u.status, u.failed_login_count,
        u.login_blocked_until, u.created_at, u.updated_at, u.deleted_at, u.deleted_by,
        t.name as team_name
      from app_user u left join team t on t.id = u.team_id
      where u.deleted_at is null ${byTeam}
      order by array_position(array['head', 'manager', 'staff'], u.role), u.full_name`;
  }

  async create(input: CreateUserInput): Promise<UserRow> {
    try {
      const [row] = await this.sql<UserRow[]>`
        insert into app_user (email, full_name, role, team_id, password_hash)
        values (${normalize(input.email)}, ${input.fullName}, ${input.role}, ${input.teamId}, ${input.passwordHash})
        returning ${this.columns()}`;
      return row!;
    } catch (error) {
      const e = error as { code?: string; constraint_name?: string };
      if (e.code === '23505' && e.constraint_name === 'ux_app_user_email') throw new EmailTakenError();
      throw error;
    }
  }

  async update(id: string, patch: UpdateUserPatch): Promise<UserRow> {
    const set: Record<string, unknown> = {};
    if (patch.fullName !== undefined) set.full_name = patch.fullName;
    if (patch.role !== undefined) set.role = patch.role;
    if (patch.teamId !== undefined) set.team_id = patch.teamId;
    const [row] = await this.sql<UserRow[]>`
      update app_user set ${this.sql(set)} where id = ${id} and deleted_at is null
      returning ${this.columns()}`;
    if (!row) throw new Error(`app_user ${id} không tồn tại`);
    return row;
  }

  async setStatus(id: string, status: 'active' | 'locked'): Promise<UserRow> {
    const [row] = await this.sql<UserRow[]>`
      update app_user set status = ${status} where id = ${id} and deleted_at is null
      returning ${this.columns()}`;
    if (!row) throw new Error(`app_user ${id} không tồn tại`);
    return row;
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
  async recordFailedLogin(
    id: string,
    threshold: number,
    blockSeconds: number,
  ): Promise<FailedLoginResult | null> {
    const [row] = await this.sql<FailedLoginResult[]>`
      update app_user
      set failed_login_count = failed_login_count + 1,
        login_blocked_until = case
          when failed_login_count + 1 >= ${threshold} then now() + make_interval(secs => ${blockSeconds})
          else login_blocked_until
        end
      where id = ${id}
      returning failed_login_count as "failedLoginCount", login_blocked_until as "loginBlockedUntil"`;
    return row ?? null;
  }

  /**
   * Về 0 khi đăng nhập đúng, nhưng chỉ khi không đang bị chặn (kiểm và ghi trong một câu):
   * một lần sai song song có thể vừa đặt chặn trong lúc verify. Trả false nếu đang bị chặn.
   */
  async clearFailedLoginsUnlessBlocked(id: string): Promise<boolean> {
    const rows = await this.sql`
      update app_user set failed_login_count = 0, login_blocked_until = null
      where id = ${id} and (login_blocked_until is null or login_blocked_until <= now())
      returning id`;
    return rows.length > 0;
  }

  async setPasswordHash(id: string, hash: string): Promise<void> {
    await this.sql`
      update app_user
      set password_hash = ${hash}, failed_login_count = 0, login_blocked_until = null
      where id = ${id}`;
  }
}
