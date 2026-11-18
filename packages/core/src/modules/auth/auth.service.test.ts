import { beforeEach, describe, expect, it } from 'vitest';
import { AuthError, NotFoundError, ValidationError } from '../../errors';
import type { SessionStore, UnitOfWork, UserStore } from '../../unit-of-work';
import { AuthService } from './auth.service';
import { DUMMY_HASH, type PasswordHasher } from './password-hasher';
import { hashToken } from './session-token';

const SECRET = 's'.repeat(32);
const NOW = new Date('2026-11-18T03:00:00.000Z');
const IDLE_MS = 21600_000;
const CORRECT = 'matkhau-dung';

const MSG_WRONG = 'Email hoặc mật khẩu không đúng';
const MSG_BLOCKED = 'Nhập sai quá nhiều lần, vui lòng thử lại sau 15 phút';
const MSG_LOCKED = 'Tài khoản đã bị khóa, liên hệ Quản lý hoặc Trưởng phòng';
const MSG_EXPIRED = 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại';

interface FakeUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  team_id: string | null;
  status: string;
  password_hash: string | null;
  failed_login_count: number;
  login_blocked_until: string | null;
}

interface FakeSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

/** Hasher giả: hash = 'h:' + mật khẩu; ghi lại mọi lần verify. */
class FakeHasher implements PasswordHasher {
  verifyCalls: string[] = [];
  async hash(password: string) {
    return `h:${password}`;
  }
  async verify(password: string, phc: string) {
    this.verifyCalls.push(phc);
    return phc === `h:${password}`;
  }
}

class Fake {
  users: FakeUser[] = [];
  sessions: FakeSession[] = [];
  calls: string[] = [];
  transactions = 0;
  now = NOW;

  readonly userStore: UserStore = {
    findCredentialsByEmail: async (email) => {
      const u = this.users.find((x) => x.email === email.trim().toLowerCase());
      return u
        ? {
            id: u.id,
            passwordHash: u.password_hash,
            status: u.status,
            failedLoginCount: u.failed_login_count,
            loginBlockedUntil: u.login_blocked_until,
          }
        : null;
    },
    findByEmail: async (email) => {
      const u = this.users.find((x) => x.email === email.trim().toLowerCase());
      return u ? this.row(u) : null;
    },
    recordFailedLogin: async (id, threshold, blockSeconds) => {
      this.calls.push(`recordFailedLogin:${id}`);
      const u = this.users.find((x) => x.id === id)!;
      u.failed_login_count += 1;
      if (u.failed_login_count >= threshold) {
        u.login_blocked_until = new Date(this.now.getTime() + blockSeconds * 1000).toISOString();
      }
      return { failedLoginCount: u.failed_login_count, loginBlockedUntil: u.login_blocked_until };
    },
    clearFailedLoginsUnlessBlocked: async (id) => {
      this.calls.push(`clearFailedLoginsUnlessBlocked:${id}`);
      const u = this.users.find((x) => x.id === id)!;
      if (u.login_blocked_until && Date.parse(u.login_blocked_until) > this.now.getTime()) return false;
      u.failed_login_count = 0;
      u.login_blocked_until = null;
      return true;
    },
    setPasswordHash: async (id, hash) => {
      this.calls.push(`setPasswordHash:${id}:${this.transactions}`);
      this.users.find((x) => x.id === id)!.password_hash = hash;
    },
  };

  readonly sessionStore: SessionStore = {
    create: async (userId, tokenHash, expiresAt) => {
      this.sessions.push({ id: `s${this.sessions.length + 1}`, userId, tokenHash, expiresAt });
    },
    findActiveWithUser: async (tokenHash) => {
      const s = this.sessions.find((x) => x.tokenHash === tokenHash && x.expiresAt > this.now);
      const u = s && this.users.find((x) => x.id === s.userId);
      return s && u ? { sessionId: s.id, expiresAt: s.expiresAt.toISOString(), user: this.row(u) } : null;
    },
    extend: async (sessionId, expiresAt) => {
      this.calls.push(`extend:${sessionId}:${expiresAt.toISOString()}`);
      this.sessions.find((x) => x.id === sessionId)!.expiresAt = expiresAt;
    },
    deleteByTokenHash: async (tokenHash) => {
      this.calls.push(`deleteByTokenHash:${tokenHash}`);
      this.sessions = this.sessions.filter((x) => x.tokenHash !== tokenHash);
    },
    deleteByUser: async (userId) => {
      this.calls.push(`deleteByUser:${userId}:${this.transactions}`);
      this.sessions = this.sessions.filter((x) => x.userId !== userId);
    },
    deleteExpiredByUser: async (userId) => {
      this.calls.push(`deleteExpiredByUser:${userId}`);
    },
  };

  readonly uow: UnitOfWork = {
    transaction: async (fn) => {
      this.transactions += 1;
      return fn({ users: this.userStore, sessions: this.sessionStore });
    },
  };

  private row(u: FakeUser) {
    return {
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      role: u.role,
      team_id: u.team_id,
      status: u.status,
      failed_login_count: u.failed_login_count,
      login_blocked_until: u.login_blocked_until,
      created_at: NOW.toISOString(),
      updated_at: NOW.toISOString(),
      deleted_at: null,
      deleted_by: null,
    };
  }
}

let fake: Fake;
let hasher: FakeHasher;
let service: AuthService;

beforeEach(() => {
  fake = new Fake();
  fake.users.push({
    id: 'u1',
    email: 'quan.ly.1@example.com',
    full_name: 'Trần Thị Quản Lý Một',
    role: 'manager',
    team_id: 't1',
    status: 'active',
    password_hash: `h:${CORRECT}`,
    failed_login_count: 0,
    login_blocked_until: null,
  });
  hasher = new FakeHasher();
  service = new AuthService({
    users: fake.userStore,
    sessions: fake.sessionStore,
    uow: fake.uow,
    hasher,
    sessionSecret: SECRET,
    now: () => fake.now,
  });
});

const user = () => fake.users[0]!;

describe('login', () => {
  it('đúng mật khẩu: lưu hash token, hạn now + 6h, trả CurrentUser', async () => {
    const { token, user: current } = await service.login(' Quan.Ly.1@Example.com ', CORRECT);
    expect(fake.sessions).toHaveLength(1);
    expect(fake.sessions[0]!.tokenHash).toBe(hashToken(token, SECRET));
    expect(fake.sessions[0]!.tokenHash).not.toBe(token);
    expect(fake.sessions[0]!.expiresAt.getTime()).toBe(NOW.getTime() + IDLE_MS);
    expect(current).toEqual({
      id: 'u1',
      email: 'quan.ly.1@example.com',
      fullName: 'Trần Thị Quản Lý Một',
      role: 'manager',
      teamId: 't1',
    });
    expect(fake.calls).toContain('deleteExpiredByUser:u1');
  });

  it('email không có: verify với DUMMY_HASH, câu chung', async () => {
    await expect(service.login('khong@example.com', 'x')).rejects.toThrow(new AuthError(MSG_WRONG));
    expect(hasher.verifyCalls).toEqual([DUMMY_HASH]);
  });

  it('sai 1–9 lần câu chung, lần 10 câu chặn', async () => {
    for (let i = 1; i <= 9; i++) {
      await expect(service.login(user().email, 'sai')).rejects.toThrow(MSG_WRONG);
    }
    await expect(service.login(user().email, 'sai')).rejects.toThrow(MSG_BLOCKED);
  });

  it('đang chặn thì nhập đúng vẫn bị chặn, không verify', async () => {
    user().failed_login_count = 10;
    user().login_blocked_until = new Date(NOW.getTime() + 60_000).toISOString();
    await expect(service.login(user().email, CORRECT)).rejects.toThrow(MSG_BLOCKED);
    expect(hasher.verifyCalls).toEqual([]);
  });

  it('qua 15 phút nhập đúng thì vào được, đếm sai được reset', async () => {
    user().failed_login_count = 10;
    user().login_blocked_until = new Date(NOW.getTime() + 900_000).toISOString();
    fake.now = new Date(NOW.getTime() + 900_001);
    await expect(service.login(user().email, CORRECT)).resolves.toHaveProperty('token');
    expect(fake.calls).toContain('clearFailedLoginsUnlessBlocked:u1');
  });

  it('bị chặn trong lúc verify (lần sai song song thứ 10) → đúng mật khẩu vẫn bị chặn, không tạo phiên', async () => {
    user().failed_login_count = 9;
    hasher.verify = async (password, phc) => {
      user().failed_login_count = 10;
      user().login_blocked_until = new Date(NOW.getTime() + 900_000).toISOString();
      return phc === `h:${password}`;
    };
    await expect(service.login(user().email, CORRECT)).rejects.toThrow(MSG_BLOCKED);
    expect(fake.sessions).toHaveLength(0);
  });

  it('chưa có mật khẩu: câu chung, có tính lần sai', async () => {
    user().password_hash = null;
    await expect(service.login(user().email, CORRECT)).rejects.toThrow(MSG_WRONG);
    expect(fake.calls).toContain('recordFailedLogin:u1');
  });

  it('tài khoản khóa: đúng mật khẩu câu khóa, sai mật khẩu câu chung', async () => {
    user().status = 'locked';
    await expect(service.login(user().email, CORRECT)).rejects.toThrow(MSG_LOCKED);
    await expect(service.login(user().email, 'sai')).rejects.toThrow(MSG_WRONG);
    expect(fake.sessions).toHaveLength(0);
  });
});

describe('authenticate', () => {
  it.each([undefined, ''])('token %j → câu hết hạn', async (token) => {
    await expect(service.authenticate(token)).rejects.toThrow(new AuthError(MSG_EXPIRED));
  });

  it('token không có phiên → câu hết hạn', async () => {
    await expect(service.authenticate('khong-co')).rejects.toThrow(MSG_EXPIRED);
  });

  it('trả CurrentUser cho phiên hợp lệ', async () => {
    const { token } = await service.login(user().email, CORRECT);
    await expect(service.authenticate(token)).resolves.toMatchObject({ id: 'u1', role: 'manager' });
  });

  it('user bị khóa khi đang có phiên → xóa phiên, câu khóa', async () => {
    const { token } = await service.login(user().email, CORRECT);
    user().status = 'locked';
    await expect(service.authenticate(token)).rejects.toThrow(MSG_LOCKED);
    expect(fake.calls).toContain(`deleteByTokenHash:${hashToken(token, SECRET)}`);
    expect(fake.sessions).toHaveLength(0);
  });

  it('gia hạn dưới 5 phút thì không extend, trên 5 phút thì extend tới now + 6h', async () => {
    const { token } = await service.login(user().email, CORRECT);
    const session = fake.sessions[0]!;

    session.expiresAt = new Date(NOW.getTime() + IDLE_MS - 60_000);
    await service.authenticate(token);
    expect(fake.calls.some((c) => c.startsWith('extend:'))).toBe(false);

    session.expiresAt = new Date(NOW.getTime() + IDLE_MS - 301_000);
    await service.authenticate(token);
    expect(fake.calls).toContain(`extend:${session.id}:${new Date(NOW.getTime() + IDLE_MS).toISOString()}`);
  });
});

describe('logout', () => {
  it('không có token thì không ném', async () => {
    await expect(service.logout(undefined)).resolves.toBeUndefined();
  });

  it('xóa phiên theo hash token', async () => {
    const { token } = await service.login(user().email, CORRECT);
    await service.logout(token);
    expect(fake.calls).toContain(`deleteByTokenHash:${hashToken(token, SECRET)}`);
    expect(fake.sessions).toHaveLength(0);
  });
});

describe('setPassword', () => {
  it.each([
    ['7 ký tự', '1234567'],
    ['129 ký tự', 'a'.repeat(129)],
  ])('%s → ValidationError', async (_name, password) => {
    await expect(service.setPassword(user().email, password)).rejects.toBeInstanceOf(ValidationError);
  });

  it('email không có → NotFoundError', async () => {
    await expect(service.setPassword('khong@example.com', '12345678')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('ghi hash và cắt mọi phiên trong một transaction', async () => {
    await service.login(user().email, CORRECT);
    await service.setPassword(' Quan.Ly.1@Example.com ', 'mat-khau-moi');
    expect(user().password_hash).toBe('h:mat-khau-moi');
    expect(fake.calls).toContain('setPasswordHash:u1:1');
    expect(fake.calls).toContain('deleteByUser:u1:1');
    expect(fake.sessions).toHaveLength(0);
  });
});
