// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
  path?: string;
  maxAge?: number;
}

const jar = new Map<string, { value: string; options: CookieOptions }>();
const cookieStore = {
  get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)!.value } : undefined),
  set: (name: string, value: string, options: CookieOptions) => jar.set(name, { value, options }),
};
vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));

const service = {
  login: vi.fn(),
  authenticate: vi.fn(),
  logout: vi.fn(),
};
vi.mock('@ts24-htkh/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ts24-htkh/core')>()),
  getContainer: () => ({ authService: service }),
}));

const { AuthError } = await import('@ts24-htkh/core');
const login = await import('./login/route');
const logout = await import('./logout/route');
const me = await import('./me/route');

const COOKIE = '__Host-ts24-htkh-session';
const USER = { id: 'u1', email: 'a@b.vn', fullName: 'A', role: 'staff', teamId: 't1' };
const TOKEN = 'token-bi-mat-123';

const post = (body: unknown) =>
  new Request('http://localhost/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  jar.clear();
  vi.resetAllMocks();
});

describe('POST /auth/login', () => {
  it('đúng → 200, đặt cookie phiên, body không có token', async () => {
    service.login.mockResolvedValue({ token: TOKEN, user: USER });
    const res = await login.POST(post({ email: ' a@b.vn ', password: 'x' }));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ user: USER });
    expect(text).not.toContain(TOKEN);
    expect(service.login).toHaveBeenCalledWith('a@b.vn', 'x');
    const cookie = jar.get(COOKIE)!;
    expect(cookie.value).toBe(TOKEN);
    expect(cookie.options).toEqual({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
  });

  it('thiếu mật khẩu → 400', async () => {
    const res = await login.POST(post({ email: 'a@b.vn' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION');
    expect(service.login).not.toHaveBeenCalled();
  });

  it('body không phải JSON → 400', async () => {
    const req = new Request('http://localhost/api/v1/auth/login', { method: 'POST', body: 'khong-json' });
    expect((await login.POST(req)).status).toBe(400);
  });

  it('AuthError → 401, không đặt cookie', async () => {
    service.login.mockRejectedValue(new AuthError('Email hoặc mật khẩu không đúng'));
    const res = await login.POST(post({ email: 'a@b.vn', password: 'sai' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: { code: 'AUTH', message: 'Email hoặc mật khẩu không đúng' } });
    expect(jar.has(COOKIE)).toBe(false);
  });
});

describe('GET /auth/me', () => {
  it('không cookie → 401', async () => {
    service.authenticate.mockRejectedValue(new AuthError('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại'));
    const res = await me.GET();
    expect(res.status).toBe(401);
    expect(service.authenticate).toHaveBeenCalledWith(undefined);
  });

  it('tài khoản bị khóa → 401 câu khóa', async () => {
    jar.set(COOKIE, { value: TOKEN, options: {} });
    service.authenticate.mockRejectedValue(new AuthError('Tài khoản đã bị khóa, liên hệ Quản lý hoặc Trưởng phòng'));
    const res = await me.GET();
    expect(res.status).toBe(401);
    expect((await res.json()).error.message).toBe('Tài khoản đã bị khóa, liên hệ Quản lý hoặc Trưởng phòng');
  });

  it('tài khoản hoạt động → 200 { user }', async () => {
    jar.set(COOKIE, { value: TOKEN, options: {} });
    service.authenticate.mockResolvedValue(USER);
    const res = await me.GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: USER });
    expect(service.authenticate).toHaveBeenCalledWith(TOKEN);
  });
});

describe('POST /auth/logout', () => {
  it('có cookie → 204, xóa phiên và cookie', async () => {
    jar.set(COOKIE, { value: TOKEN, options: {} });
    service.logout.mockResolvedValue(undefined);
    const res = await logout.POST();
    expect(res.status).toBe(204);
    expect(service.logout).toHaveBeenCalledWith(TOKEN);
    expect(jar.get(COOKIE)).toEqual({
      value: '',
      options: { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 },
    });
  });

  it('không cookie → 204', async () => {
    service.logout.mockResolvedValue(undefined);
    const res = await logout.POST();
    expect(res.status).toBe(204);
    expect(service.logout).toHaveBeenCalledWith(undefined);
  });
});
