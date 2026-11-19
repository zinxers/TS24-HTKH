import type { Sql } from '../client';

export type AuditAction =
  | 'account.create'
  | 'account.update'
  | 'account.lock'
  | 'account.unlock'
  | 'account.delete'
  | 'account.set_password'
  | 'account.transfer_head'
  | 'profile.update'
  | 'rate.set';

export interface AuditEntry {
  actorId: string;
  action: AuditAction;
  targetId: string | null;
  detail?: Record<string, unknown>;
}

/** audit_log chỉ thêm: không có hàm sửa, xóa (DB cũng không cấp quyền). */
export class AuditLogRepository {
  constructor(private readonly sql: Sql) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.sql`
      insert into audit_log (actor_id, action, target_id, detail)
      values (${entry.actorId}, ${entry.action}, ${entry.targetId}, ${this.sql.json((entry.detail ?? {}) as never)})`;
  }
}
