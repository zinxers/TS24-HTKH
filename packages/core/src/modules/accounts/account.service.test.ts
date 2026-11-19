import { EmailTakenError, type AuditEntry, type TeamRow, type UserRow } from '@ts24-htkh/db';
import type { CurrentUser, Role } from '@ts24-htkh/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../errors';
import type { AuditStore, Repos, SessionStore, TeamStore, UnitOfWork, UserStore } from '../../unit-of-work';
import type { PasswordHasher } from '../auth/password-hasher';
import { AccountService } from './account.service';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const PASSWORD = 'mat-khau-bi-mat-123';

function row(id: string, role: Role, teamId: string | null, status = 'active'): UserRow {
  return {
    id,
    email: `${id.toLowerCase()}@example.com`,
    full_name: `Tên ${id}`,
    role,
    team_id: teamId,
    status,
    failed_login_count: 0,
    login_blocked_until: null,
    created_at: '2026-11-18T00:00:00.000Z',
    updated_at: '2026-11-18T00:00:00.000Z',
    deleted_at: null,
    deleted_by: null,
  };
}

const asActor = (r: UserRow): CurrentUser => ({
  id: r.id,
  email: r.email,
  fullName: r.full_name,
  role: r.role as Role,
  teamId: r.team_id,
});

class Fake {
  users = new Map<string, UserRow>();
  audits: AuditEntry[] = [];
  deletedSessions: string[] = [];
  calls: string[] = [];
  hashes: [string, string][] = [];
  createError: Error | undefined;

  constructor() {
    for (const r of [
      row('H', 'head', null),
      row('M', 'manager', A),
      row('M2', 'manager', B),
      row('S', 'staff', A),
      row('SA', 'staff', A),
      row('SB', 'staff', B),
      row('SL', 'staff', A, 'locked'),
    ]) {
      this.users.set(r.id, r);
    }
    const gone = row('SX', 'staff', A);
    this.users.set('SX', { ...gone, deleted_at: '2026-11-18T00:00:00.000Z' });
  }

  private live(id: string): UserRow | null {
    const r = this.users.get(id);
    return r && !r.deleted_at ? { ...r } : null;
  }

  userStore = {
    findById: async (id: string) => this.live(id),
    findByIdForUpdate: async (id: string) => {
      this.calls.push(`lock:${id}`);
      return this.live(id);
    },
    listActive: async (filter: { teamId?: string }) =>
      [...this.users.values()]
        .filter((r) => !r.deleted_at && (filter.teamId === undefined || r.team_id === filter.teamId))
        .map((r) => ({ ...r, team_name: r.team_id === A ? 'Team A' : r.team_id === B ? 'Team B' : null })),
    create: async (input: { email: string; fullName: string; role: Role; teamId: string; passwordHash: string }) => {
      if (this.createError) throw this.createError;
      const r = { ...row('NEW', input.role, input.teamId), email: input.email, full_name: input.fullName };
      this.users.set('NEW', r);
      return r;
    },
    update: async (id: string, patch: { fullName?: string; role?: Role; teamId?: string | null }) => {
      this.calls.push(`update:${id}:${patch.role ?? ''}`);
      const r = this.users.get(id)!;
      const next = {
        ...r,
        full_name: patch.fullName ?? r.full_name,
        role: patch.role ?? r.role,
        team_id: patch.teamId === undefined ? r.team_id : patch.teamId,
      };
      this.users.set(id, next);
      return { ...next };
    },
    setStatus: async (id: string, status: 'active' | 'locked') => {
      const next = { ...this.users.get(id)!, status };
      this.users.set(id, next);
      return { ...next };
    },
    softDelete: async (id: string, actorId: string) => {
      const r = this.users.get(id)!;
      if (r.deleted_at) return false;
      this.users.set(id, { ...r, deleted_at: 'now', deleted_by: actorId });
      return true;
    },
    setPasswordHash: async (id: string, hash: string) => {
      this.hashes.push([id, hash]);
    },
  } as unknown as UserStore;

  sessionStore = {
    deleteByUser: async (id: string) => {
      this.deletedSessions.push(id);
    },
  } as unknown as SessionStore;

  auditStore: AuditStore = {
    record: async (entry) => {
      this.audits.push(entry);
    },
  };

  teamStore = {
    list: async () =>
      [
        { id: A, name: 'Team A' },
        { id: B, name: 'Team B' },
      ] as TeamRow[],
  } as TeamStore;

  uow: UnitOfWork = {
    transaction: (fn) =>
      fn({ users: this.userStore, sessions: this.sessionStore, audit: this.auditStore } as Repos),
  };

  hasher: PasswordHasher = {
    hash: async (p: string) => `h:${p}`,
    verify: async () => true,
  };
}

let fake: Fake;
let service: AccountService;
const actor = (id: string) => asActor(fake.users.get(id)!);

beforeEach(() => {
  fake = new Fake();
  service = new AccountService({ users: fake.userStore, teams: fake.teamStore, hasher: fake.hasher, uow: fake.uow });
});

describe('phạm vi xem và quyền', () => {
  it.each([
    ['M thao tác staff team khác', 'M', 'SB'],
    ['M thao tác Quản lý khác', 'M', 'M2'],
    ['M thao tác Trưởng phòng', 'M', 'H'],
    ['S thao tác người khác', 'S', 'SA'],
    ['đích đã xóa mềm', 'H', 'SX'],
    ['đích không tồn tại', 'H', 'KHONG'],
  ])('%s → NotFoundError', async (_name, a, t) => {
    await expect(service.setStatus(actor(a), t, 'locked')).rejects.toEqual(
      new NotFoundError('Không tìm thấy tài khoản'),
    );
    expect(fake.audits).toEqual([]);
  });

  it.each([
    ['H khóa chính mình', 'H', 'H'],
    ['M khóa chính mình', 'M', 'M'],
    ['S khóa chính mình', 'S', 'S'],
  ])('%s → ForbiddenError', async (_name, a, t) => {
    await expect(service.setStatus(actor(a), t, 'locked')).rejects.toEqual(
      new ForbiddenError('Bạn không có quyền thực hiện thao tác này'),
    );
    expect(fake.audits).toEqual([]);
  });

  it('M nâng staff lên manager hoặc chuyển team → ForbiddenError, không đổi gì', async () => {
    await expect(service.update(actor('M'), 'SA', { role: 'manager' })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.update(actor('M'), 'SA', { teamId: B })).rejects.toBeInstanceOf(ForbiddenError);
    expect(fake.users.get('SA')).toMatchObject({ role: 'staff', team_id: A });
    expect(fake.audits).toEqual([]);
  });

  it('M tạo tài khoản team khác hoặc vai trò manager → ForbiddenError', async () => {
    const input = { email: 'x@example.com', fullName: 'X', role: 'staff' as const, teamId: B, password: PASSWORD };
    await expect(service.create(actor('M'), input)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.create(actor('M'), { ...input, teamId: A, role: 'manager' })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('team không tồn tại → ValidationError', async () => {
    const input = { email: 'x@example.com', fullName: 'X', role: 'staff' as const, teamId: 'khong', password: PASSWORD };
    await expect(service.create(actor('H'), input)).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('list', () => {
  it('Quản lý chỉ thấy chính mình và staff team mình; không có trường mật khẩu', async () => {
    const list = await service.list(actor('M'));
    expect(list.map((a) => a.id).sort()).toEqual(['M', 'S', 'SA', 'SL']);
    for (const a of list) {
      expect(Object.keys(a)).not.toContain('passwordHash');
      expect(Object.keys(a)).not.toContain('password_hash');
    }
    expect(list.find((a) => a.id === 'SA')).toMatchObject({ fullName: 'Tên SA', teamName: 'Team A', status: 'active' });
  });

  it('Trưởng phòng thấy tất cả trừ người đã xóa', async () => {
    const ids = (await service.list(actor('H'))).map((a) => a.id);
    expect(ids).toHaveLength(7);
    expect(ids).not.toContain('SX');
  });

  it('Nhân Viên → ForbiddenError', async () => {
    await expect(service.list(actor('S'))).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('ghi audit_log và xóa phiên', () => {
  it('create: audit account.create, không có mật khẩu; trả AccountView', async () => {
    const view = await service.create(actor('M'), {
      email: 'moi@example.com',
      fullName: 'Người mới',
      role: 'staff',
      teamId: A,
      password: PASSWORD,
    });
    expect(view).toMatchObject({ email: 'moi@example.com', role: 'staff', teamName: 'Team A' });
    expect(fake.audits.map((a) => a.action)).toEqual(['account.create']);
    expect(JSON.stringify(fake.audits)).not.toContain(PASSWORD);
    expect(JSON.stringify(view)).not.toContain(PASSWORD);
  });

  it('create trùng email → ConflictError', async () => {
    fake.createError = new EmailTakenError();
    await expect(
      service.create(actor('H'), { email: 'a@example.com', fullName: 'A', role: 'staff', teamId: A, password: PASSWORD }),
    ).rejects.toEqual(new ConflictError('Email đã có tài khoản'));
  });

  it('update chỉ họ tên: detail chỉ trường đổi, không xóa phiên', async () => {
    await service.update(actor('M'), 'SA', { fullName: 'Tên mới' });
    expect(fake.audits).toEqual([
      { actorId: 'M', action: 'account.update', targetId: 'SA', detail: { fullName: { from: 'Tên SA', to: 'Tên mới' } } },
    ]);
    expect(fake.deletedSessions).toEqual([]);
  });

  it.each([
    ['đổi vai trò', { role: 'manager' as const }],
    ['đổi team', { teamId: B }],
  ])('update %s: xóa phiên đích', async (_name, patch) => {
    await service.update(actor('H'), 'SA', patch);
    expect(fake.audits).toHaveLength(1);
    expect(fake.deletedSessions).toEqual(['SA']);
  });

  it('Trưởng phòng đổi họ tên chính mình được; đổi vai trò chính mình → ForbiddenError', async () => {
    await expect(service.update(actor('H'), 'H', { fullName: 'TP' })).resolves.toMatchObject({ fullName: 'TP' });
    await expect(service.update(actor('H'), 'H', { role: 'manager' })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('lock: audit account.lock, xóa phiên; unlock: account.unlock, không xóa phiên', async () => {
    await expect(service.setStatus(actor('M'), 'SA', 'locked')).resolves.toMatchObject({ status: 'locked' });
    await service.setStatus(actor('M'), 'SL', 'active');
    expect(fake.audits.map((a) => a.action)).toEqual(['account.lock', 'account.unlock']);
    expect(fake.deletedSessions).toEqual(['SA']);
  });

  it('delete: xóa mềm, audit account.delete, xóa phiên', async () => {
    await service.delete(actor('H'), 'M2');
    expect(fake.users.get('M2')!.deleted_by).toBe('H');
    expect(fake.audits.map((a) => a.action)).toEqual(['account.delete']);
    expect(fake.deletedSessions).toEqual(['M2']);
  });

  it('setPassword: băm, audit detail {}, xóa phiên, không lộ mật khẩu', async () => {
    await service.setPassword(actor('M'), 'SA', PASSWORD);
    expect(fake.hashes).toEqual([['SA', `h:${PASSWORD}`]]);
    expect(fake.audits).toEqual([{ actorId: 'M', action: 'account.set_password', targetId: 'SA', detail: {} }]);
    expect(fake.deletedSessions).toEqual(['SA']);
    expect(JSON.stringify(fake.audits)).not.toContain(PASSWORD);
  });

  it('setPassword 7 ký tự → ValidationError', async () => {
    await expect(service.setPassword(actor('H'), 'SA', '1234567')).rejects.toBeInstanceOf(ValidationError);
    expect(fake.hashes).toEqual([]);
  });

  it('updateProfile: audit profile.update, trả CurrentUser mới', async () => {
    await expect(service.updateProfile(actor('S'), 'Tên tôi')).resolves.toEqual({
      ...actor('S'),
      fullName: 'Tên tôi',
    });
    expect(fake.audits).toEqual([
      { actorId: 'S', action: 'profile.update', targetId: 'S', detail: { fullName: { from: 'Tên S', to: 'Tên tôi' } } },
    ]);
  });
});

describe('transferHead', () => {
  const input = { toUserId: 'SA', newRole: 'manager' as const, newTeamId: A };

  it('thành công: hạ người làm trước, nâng đích sau, xóa phiên hai người, một audit', async () => {
    await service.transferHead(actor('H'), input);
    expect(fake.calls.filter((c) => c.startsWith('update:'))).toEqual(['update:H:manager', 'update:SA:head']);
    expect(fake.users.get('H')).toMatchObject({ role: 'manager', team_id: A });
    expect(fake.users.get('SA')).toMatchObject({ role: 'head', team_id: null });
    expect(fake.deletedSessions.sort()).toEqual(['H', 'SA']);
    expect(fake.audits).toEqual([
      {
        actorId: 'H',
        action: 'account.transfer_head',
        targetId: 'SA',
        detail: {
          actor: { role: { from: 'head', to: 'manager' }, teamId: { from: null, to: A } },
          target: { role: { from: 'staff', to: 'head' }, teamId: { from: A, to: null } },
        },
      },
    ]);
  });

  it.each([
    ['đích bị khóa', { ...input, toUserId: 'SL' }, ValidationError],
    ['đích là chính mình', { ...input, toUserId: 'H' }, ValidationError],
    ['team mới không tồn tại', { ...input, newTeamId: 'khong' }, ValidationError],
    ['đích đã xóa', { ...input, toUserId: 'SX' }, NotFoundError],
  ])('%s → lỗi, không đổi gì', async (_name, bad, error) => {
    await expect(service.transferHead(actor('H'), bad)).rejects.toBeInstanceOf(error);
    expect(fake.users.get('H')!.role).toBe('head');
    expect(fake.audits).toEqual([]);
  });

  it('người làm không phải Trưởng phòng → ForbiddenError', async () => {
    await expect(service.transferHead(actor('M'), input)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('listTeams', () => {
  it('trả id và tên', async () => {
    expect(await service.listTeams()).toEqual([
      { id: A, name: 'Team A' },
      { id: B, name: 'Team B' },
    ]);
  });
});
