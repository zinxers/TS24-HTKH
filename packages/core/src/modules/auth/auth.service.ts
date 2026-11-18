import type { CurrentUser } from '@ts24-htkh/shared';
import { AuthError, NotFoundError, ValidationError } from '../../errors';
import type { SessionStore, UnitOfWork, UserStore } from '../../unit-of-work';
import { toCurrentUser, type LoginResult } from './auth.dto';
import { DUMMY_HASH, type PasswordHasher } from './password-hasher';
import { hashToken, newToken } from './session-token';

export const MAX_LOGIN_FAILS = 10;
export const LOGIN_BLOCK_SECONDS = 900;
export const SESSION_IDLE_SECONDS = 21600;
export const SESSION_REFRESH_AFTER_SECONDS = 300;

const MSG_WRONG = 'Email hoặc mật khẩu không đúng';
const MSG_BLOCKED = 'Nhập sai quá nhiều lần, vui lòng thử lại sau 15 phút';
const MSG_LOCKED = 'Tài khoản đã bị khóa, liên hệ Quản lý hoặc Trưởng phòng';
const MSG_EXPIRED = 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại';

export interface AuthServiceDeps {
  users: UserStore;
  sessions: SessionStore;
  uow: UnitOfWork;
  hasher: PasswordHasher;
  sessionSecret: string;
  now?: () => Date;
}

export class AuthService {
  private readonly now: () => Date;

  constructor(private readonly deps: AuthServiceDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const { users, sessions, hasher } = this.deps;
    const cred = await users.findCredentialsByEmail(email);
    if (!cred) {
      await hasher.verify(password, DUMMY_HASH);
      throw new AuthError(MSG_WRONG);
    }

    const now = this.now();
    if (cred.loginBlockedUntil && Date.parse(cred.loginBlockedUntil) > now.getTime()) {
      throw new AuthError(MSG_BLOCKED);
    }

    const ok = await hasher.verify(password, cred.passwordHash ?? DUMMY_HASH);
    if (!ok || !cred.passwordHash) {
      const after = await users.recordFailedLogin(cred.id, MAX_LOGIN_FAILS, LOGIN_BLOCK_SECONDS);
      // Theo số đếm (DB đặt chặn khi đếm >= ngưỡng), không so đồng hồ app với now() của DB.
      throw new AuthError(after && after.failedLoginCount >= MAX_LOGIN_FAILS ? MSG_BLOCKED : MSG_WRONG);
    }

    // Kiểm khóa sau mật khẩu: đoán sai không lộ tài khoản bị khóa.
    if (cred.status === 'locked') throw new AuthError(MSG_LOCKED);

    const row = await users.findByEmail(email);
    if (!row) throw new AuthError(MSG_WRONG);
    // Kiểm chặn lần nữa, nguyên tử với việc xóa đếm: chặn có thể vừa được đặt trong lúc verify.
    if (!(await users.clearFailedLoginsUnlessBlocked(cred.id))) throw new AuthError(MSG_BLOCKED);
    await sessions.deleteExpiredByUser(cred.id);
    const token = newToken();
    await sessions.create(cred.id, hashToken(token, this.deps.sessionSecret), this.expiryFrom(now));
    return { token, user: toCurrentUser(row) };
  }

  async authenticate(token: string | undefined): Promise<CurrentUser> {
    if (!token) throw new AuthError(MSG_EXPIRED);
    const { sessions } = this.deps;
    const tokenHash = hashToken(token, this.deps.sessionSecret);
    const found = await sessions.findActiveWithUser(tokenHash);
    if (!found) throw new AuthError(MSG_EXPIRED);

    if (found.user.status === 'locked') {
      await sessions.deleteByTokenHash(tokenHash);
      throw new AuthError(MSG_LOCKED);
    }

    // Lần gia hạn trước = expires_at - 6h; chỉ ghi DB khi đã quá 5 phút.
    const now = this.now();
    const lastRefresh = Date.parse(found.expiresAt) - SESSION_IDLE_SECONDS * 1000;
    if (now.getTime() - lastRefresh > SESSION_REFRESH_AFTER_SECONDS * 1000) {
      await sessions.extend(found.sessionId, this.expiryFrom(now));
    }
    return toCurrentUser(found.user);
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.deps.sessions.deleteByTokenHash(hashToken(token, this.deps.sessionSecret));
  }

  async setPassword(email: string, password: string): Promise<void> {
    if (password.length < 8 || password.length > 128) {
      throw new ValidationError('Mật khẩu phải dài 8 đến 128 ký tự');
    }
    const user = await this.deps.users.findByEmail(email);
    if (!user) throw new NotFoundError('Không tìm thấy tài khoản với email này');
    const hash = await this.deps.hasher.hash(password);
    await this.deps.uow.transaction(async ({ users, sessions }) => {
      await users.setPasswordHash(user.id, hash);
      await sessions.deleteByUser(user.id);
    });
  }

  private expiryFrom(now: Date): Date {
    return new Date(now.getTime() + SESSION_IDLE_SECONDS * 1000);
  }
}
