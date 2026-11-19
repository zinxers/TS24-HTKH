import { EmailTakenError, type UpdateUserPatch, type UserRow } from '@ts24-htkh/db';
import type {
  AccountCreateInput,
  AccountStatus,
  AccountUpdateInput,
  AccountView,
  CurrentUser,
  Team,
  TransferHeadInput,
} from '@ts24-htkh/shared';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../errors';
import { canSee } from '../../policies/permissions';
import type { Repos, TeamStore, UnitOfWork, UserStore } from '../../unit-of-work';
import { toCurrentUser } from '../auth/auth.dto';
import type { PasswordHasher } from '../auth/password-hasher';
import { toAccountView, toTarget } from './account.dto';
import { AccountPolicy, MSG_FORBIDDEN, MSG_NOT_FOUND } from './account.policy';

const MSG_PASSWORD = 'Mật khẩu phải dài 8 đến 128 ký tự';
const MSG_EMAIL_TAKEN = 'Email đã có tài khoản';
const MSG_NO_TEAM = 'Team không tồn tại';

export interface AccountServiceDeps {
  users: UserStore;
  teams: TeamStore;
  hasher: PasswordHasher;
  uow: UnitOfWork;
}

/**
 * Mỗi thao tác ghi: transaction → khóa hàng đích → phạm vi xem (404) → quyền (403)
 * → ghi → audit_log → xóa phiên khi cần.
 */
export class AccountService {
  constructor(private readonly deps: AccountServiceDeps) {}

  async list(actor: CurrentUser): Promise<AccountView[]> {
    AccountPolicy.assert(actor, 'account.list');
    const filter = actor.role === 'head' ? {} : { teamId: actor.teamId ?? undefined };
    const rows = await this.deps.users.listActive(filter);
    return rows
      .filter((r) => canSee(actor, toTarget(r)))
      .map((r) => toAccountView(r, r.team_name));
  }

  async listTeams(): Promise<Team[]> {
    return (await this.deps.teams.list()).map((t) => ({ id: t.id, name: t.name }));
  }

  async create(actor: CurrentUser, input: AccountCreateInput): Promise<AccountView> {
    AccountPolicy.assert(actor, 'account.create', undefined, { role: input.role, teamId: input.teamId });
    const teamName = await this.teamName(input.teamId);
    this.assertPassword(input.password);
    const passwordHash = await this.deps.hasher.hash(input.password);
    try {
      return await this.deps.uow.transaction(async ({ users, audit }) => {
        const row = await users.create({ ...input, passwordHash });
        await audit.record({
          actorId: actor.id,
          action: 'account.create',
          targetId: row.id,
          detail: { email: row.email, fullName: row.full_name, role: row.role, teamId: row.team_id },
        });
        return toAccountView(row, teamName);
      });
    } catch (error) {
      if (error instanceof EmailTakenError) throw new ConflictError(MSG_EMAIL_TAKEN);
      throw error;
    }
  }

  async update(actor: CurrentUser, id: string, input: AccountUpdateInput): Promise<AccountView> {
    if (input.teamId !== undefined) await this.teamName(input.teamId);
    const row = await this.deps.uow.transaction(async ({ users, sessions, audit }) => {
      const target = await this.lockVisible(users, actor, id);
      AccountPolicy.assert(actor, 'account.update', toTarget(target), { role: input.role, teamId: input.teamId });

      const patch: UpdateUserPatch = {};
      const detail: Record<string, { from: unknown; to: unknown }> = {};
      if (input.fullName !== undefined && input.fullName !== target.full_name) {
        patch.fullName = input.fullName;
        detail.fullName = { from: target.full_name, to: input.fullName };
      }
      if (input.role !== undefined && input.role !== target.role) {
        patch.role = input.role;
        detail.role = { from: target.role, to: input.role };
      }
      if (input.teamId !== undefined && input.teamId !== target.team_id) {
        patch.teamId = input.teamId;
        detail.teamId = { from: target.team_id, to: input.teamId };
      }
      if (Object.keys(patch).length === 0) return target;

      const updated = await users.update(id, patch);
      await audit.record({ actorId: actor.id, action: 'account.update', targetId: id, detail });
      if (patch.role !== undefined || patch.teamId !== undefined) await sessions.deleteByUser(id);
      return updated;
    });
    return toAccountView(row, await this.teamNameOrNull(row.team_id));
  }

  async setStatus(actor: CurrentUser, id: string, status: AccountStatus): Promise<AccountView> {
    const action = status === 'locked' ? 'account.lock' : 'account.unlock';
    const row = await this.deps.uow.transaction(async ({ users, sessions, audit }) => {
      const target = await this.lockVisible(users, actor, id);
      AccountPolicy.assert(actor, action, toTarget(target));
      const updated = await users.setStatus(id, status);
      await audit.record({
        actorId: actor.id,
        action,
        targetId: id,
        detail: { status: { from: target.status, to: status } },
      });
      if (status === 'locked') await sessions.deleteByUser(id);
      return updated;
    });
    return toAccountView(row, await this.teamNameOrNull(row.team_id));
  }

  async delete(actor: CurrentUser, id: string): Promise<void> {
    await this.deps.uow.transaction(async ({ users, sessions, audit }) => {
      const target = await this.lockVisible(users, actor, id);
      AccountPolicy.assert(actor, 'account.delete', toTarget(target));
      if (!(await users.softDelete(id, actor.id))) throw new NotFoundError(MSG_NOT_FOUND);
      await audit.record({ actorId: actor.id, action: 'account.delete', targetId: id, detail: {} });
      await sessions.deleteByUser(id);
    });
  }

  async setPassword(actor: CurrentUser, id: string, password: string): Promise<void> {
    this.assertPassword(password);
    // Băm trước khi mở transaction: argon2 chậm, không giữ khóa hàng trong lúc băm.
    const hash = await this.deps.hasher.hash(password);
    await this.deps.uow.transaction(async ({ users, sessions, audit }) => {
      const target = await this.lockVisible(users, actor, id);
      AccountPolicy.assert(actor, 'account.set_password', toTarget(target));
      await users.setPasswordHash(id, hash);
      await audit.record({ actorId: actor.id, action: 'account.set_password', targetId: id, detail: {} });
      await sessions.deleteByUser(id);
    });
  }

  async transferHead(actor: CurrentUser, input: TransferHeadInput): Promise<void> {
    AccountPolicy.assert(actor, 'account.transfer_head');
    if (input.toUserId === actor.id) throw new ValidationError('Không thể bàn giao cho chính mình');
    await this.teamName(input.newTeamId);
    await this.deps.uow.transaction(async ({ users, sessions, audit }) => {
      const me = await users.findByIdForUpdate(actor.id);
      // Phiên đọc vai trò lúc đầu request; khóa hàng rồi kiểm lại để hai lần bàn giao song song không cùng chạy.
      if (!me || me.role !== 'head') throw new ForbiddenError(MSG_FORBIDDEN);
      const target = await users.findByIdForUpdate(input.toUserId);
      if (!target) throw new NotFoundError(MSG_NOT_FOUND);
      if (target.status !== 'active') throw new ValidationError('Tài khoản nhận bàn giao đang bị khóa');

      await users.update(actor.id, { role: input.newRole, teamId: input.newTeamId });
      await users.update(target.id, { role: 'head', teamId: null });
      await audit.record({
        actorId: actor.id,
        action: 'account.transfer_head',
        targetId: target.id,
        detail: {
          actor: { role: { from: me.role, to: input.newRole }, teamId: { from: me.team_id, to: input.newTeamId } },
          target: { role: { from: target.role, to: 'head' }, teamId: { from: target.team_id, to: null } },
        },
      });
      await sessions.deleteByUser(actor.id);
      await sessions.deleteByUser(target.id);
    });
  }

  async updateProfile(actor: CurrentUser, fullName: string): Promise<CurrentUser> {
    return this.deps.uow.transaction(async ({ users, audit }) => {
      const me = await users.findByIdForUpdate(actor.id);
      if (!me) throw new NotFoundError(MSG_NOT_FOUND);
      if (me.full_name === fullName) return toCurrentUser(me);
      const updated = await users.update(actor.id, { fullName });
      await audit.record({
        actorId: actor.id,
        action: 'profile.update',
        targetId: actor.id,
        detail: { fullName: { from: me.full_name, to: fullName } },
      });
      return toCurrentUser(updated);
    });
  }

  private async lockVisible(users: Repos['users'], actor: CurrentUser, id: string): Promise<UserRow> {
    const row = await users.findByIdForUpdate(id);
    AccountPolicy.assertVisible(actor, row ? toTarget(row) : null);
    return row!;
  }

  private assertPassword(password: string): void {
    if (password.length < 8 || password.length > 128) throw new ValidationError(MSG_PASSWORD);
  }

  /** Tên team; team không tồn tại → 400 (tránh lỗi khóa ngoại lộ ra thành 500). */
  private async teamName(teamId: string): Promise<string> {
    const team = (await this.deps.teams.list()).find((t) => t.id === teamId);
    if (!team) throw new ValidationError(MSG_NO_TEAM);
    return team.name;
  }

  private async teamNameOrNull(teamId: string | null): Promise<string | null> {
    return teamId === null ? null : this.teamName(teamId);
  }
}
