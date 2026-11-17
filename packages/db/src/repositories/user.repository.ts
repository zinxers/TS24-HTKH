import type { Sql } from '../client';
import type { Database } from '../types.generated';
import { BaseRepository } from './base.repository';

export type UserRow = Database['public']['Tables']['app_user']['Row'];

export class UserRepository extends BaseRepository<UserRow> {
  constructor(sql: Sql) {
    super(sql, 'app_user');
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    const normalized = email.trim().toLowerCase();
    const [row] = await this.sql<UserRow[]>`
      select * from app_user where email = ${normalized} and deleted_at is null`;
    return row ?? null;
  }
}
