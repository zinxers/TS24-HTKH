// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const cookieStore = { get: () => ({ name: 'c', value: 'token' }), set: () => {} };
vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));

const authService = { authenticate: vi.fn() };
const accountService = {
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  setStatus: vi.fn(),
  delete: vi.fn(),
  setPassword: vi.fn(),
  transferHead: vi.fn(),
  updateProfile: vi.fn(),
  listTeams: vi.fn(),
};
vi.mock('@ts24-htkh/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ts24-htkh/core')>()),
  getContainer: () => ({ authService, accountService }),
}));

const { AuthError, ConflictError, ForbiddenError, NotFoundError } = await import('@ts24-htkh/core');
const accounts = await import('./route');
const byId = await import('./[id]/route');
const status = await import('./[id]/status/route');
const password = await import('./[id]/password/route');
const transfer = await import('./transfer-head/route');
const teams = await import('../teams/route');
const me = await import('../me/route');

const USER = { id: 'u1', email: 'h@example.com', fullName: 'H', role: 'head', teamId: null };
const ID = '00000000-0000-4000-8000-000000000001';
const TEAM = '00000000-0000-4000-8000-00000000000a';
const PASSWORD = 'mat-khau-bi-mat-123';
const ACCOUNT = {
  id: ID,
  email: 'a@example.com',
  fullName: 'A',
  role: 'staff',
  teamId: TEAM,
  teamName: 'Team A',
  status: 'active',
  createdAt: '2026-11-18T00:00:00.000Z',
};
const ctx = { params: Promise.resolve({ id: ID }) };

const req = (method: string, body?: unknown) =>
  new Request('http://localhost/api/v1/x', {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });

const createBody = { email: 'a@example.com', fullName: 'A', role: 'staff', teamId: TEAM, password: PASSWORD };

/** Mọi route với body hợp lệ. */
const routes: [string, () => Promise<Response>][] = [
  ['GET accounts', () => accounts.GET()],
  ['POST accounts', () => accounts.POST(req('POST', createBody))],
  ['PATCH [id]', () => byId.PATCH(req('PATCH', { fullName: 'B' }), ctx)],
  ['DELETE [id]', () => byId.DELETE(req('DELETE'), ctx)],
  ['PATCH status', () => status.PATCH(req('PATCH', { status: 'locked' }), ctx)],
  ['POST password', () => password.POST(req('POST', { password: PASSWORD }), ctx)],
  ['POST transfer-head', () => transfer.POST(req('POST', { toUserId: ID, newRole: 'manager', newTeamId: TEAM }))],
  ['GET teams', () => teams.GET()],
  ['PATCH me', () => me.PATCH(req('PATCH', { fullName: 'H mới' }))],
];

beforeEach(() => {
  vi.resetAllMocks();
  authService.authenticate.mockResolvedValue(USER);
});

describe('xác thực', () => {
  it.each(routes)('%s chưa đăng nhập → 401', async (_name, call) => {
    authService.authenticate.mockRejectedValue(new AuthError('Chưa đăng nhập'));
    const res = await call();
    expect(res.status).toBe(401);
    for (const fn of Object.values(accountService)) expect(fn).not.toHaveBeenCalled();
  });
});

describe('body sai → 400', () => {
  it.each([
    ['POST accounts thiếu mật khẩu', () => accounts.POST(req('POST', { ...createBody, password: undefined }))],
    ['POST accounts role head', () => accounts.POST(req('POST', { ...createBody, role: 'head' }))],
    ['POST accounts JSON hỏng', () => accounts.POST(req('POST', '{hong'))],
    ['PATCH [id] rỗng', () => byId.PATCH(req('PATCH', {}), ctx)],
    ['PATCH status sai', () => status.PATCH(req('PATCH', { status: 'deleted' }), ctx)],
    ['POST password 7 ký tự', () => password.POST(req('POST', { password: '1234567' }), ctx)],
    ['POST transfer-head newRole head', () => transfer.POST(req('POST', { toUserId: ID, newRole: 'head', newTeamId: TEAM }))],
    ['PATCH me rỗng', () => me.PATCH(req('PATCH', { fullName: ' ' }))],
  ])('%s', async (_name, call) => {
    const res = await call();
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION');
    for (const fn of Object.values(accountService)) expect(fn).not.toHaveBeenCalled();
  });
});

describe('id trên đường dẫn không phải uuid → 400, không gọi service', () => {
  const bad = { params: Promise.resolve({ id: 'abc' }) };
  it.each([
    ['PATCH [id]', () => byId.PATCH(req('PATCH', { fullName: 'B' }), bad)],
    ['DELETE [id]', () => byId.DELETE(req('DELETE'), bad)],
    ['PATCH status', () => status.PATCH(req('PATCH', { status: 'locked' }), bad)],
    ['POST password', () => password.POST(req('POST', { password: PASSWORD }), bad)],
  ])('%s', async (_name, call) => {
    const res = await call();
    expect(res.status).toBe(400);
    for (const fn of Object.values(accountService)) expect(fn).not.toHaveBeenCalled();
  });
});

describe('lỗi nghiệp vụ → mã HTTP', () => {
  it.each([
    [new ForbiddenError('Bạn không có quyền thực hiện thao tác này'), 403],
    [new NotFoundError('Không tìm thấy tài khoản'), 404],
    [new ConflictError('Email đã có tài khoản'), 409],
  ])('%s → %i', async (error, code) => {
    accountService.create.mockRejectedValue(error);
    const res = await accounts.POST(req('POST', createBody));
    expect(res.status).toBe(code);
    expect((await res.json()).error.message).toBe(error.message);
  });
});

describe('thành công', () => {
  it('GET accounts → { accounts }', async () => {
    accountService.list.mockResolvedValue([ACCOUNT]);
    const res = await accounts.GET();
    expect(await res.json()).toEqual({ accounts: [ACCOUNT] });
    expect(accountService.list).toHaveBeenCalledWith(USER);
  });

  it('POST accounts → 201 { account }, không chứa mật khẩu', async () => {
    accountService.create.mockResolvedValue(ACCOUNT);
    const res = await accounts.POST(req('POST', { ...createBody, email: ' A@Example.com ' }));
    expect(res.status).toBe(201);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ account: ACCOUNT });
    expect(text).not.toContain(PASSWORD);
    expect(accountService.create).toHaveBeenCalledWith(USER, { ...createBody, email: 'a@example.com' });
  });

  it('PATCH [id] → { account }', async () => {
    accountService.update.mockResolvedValue(ACCOUNT);
    const res = await byId.PATCH(req('PATCH', { fullName: 'B' }), ctx);
    expect(await res.json()).toEqual({ account: ACCOUNT });
    expect(accountService.update).toHaveBeenCalledWith(USER, ID, { fullName: 'B' });
  });

  it('PATCH status → { account }', async () => {
    accountService.setStatus.mockResolvedValue({ ...ACCOUNT, status: 'locked' });
    const res = await status.PATCH(req('PATCH', { status: 'locked' }), ctx);
    expect((await res.json()).account.status).toBe('locked');
    expect(accountService.setStatus).toHaveBeenCalledWith(USER, ID, 'locked');
  });

  it('DELETE [id] → 204 không body', async () => {
    const res = await byId.DELETE(req('DELETE'), ctx);
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect(accountService.delete).toHaveBeenCalledWith(USER, ID);
  });

  it('POST password → 204, không chứa mật khẩu', async () => {
    const res = await password.POST(req('POST', { password: PASSWORD }), ctx);
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect(accountService.setPassword).toHaveBeenCalledWith(USER, ID, PASSWORD);
  });

  it('POST transfer-head → 204', async () => {
    const res = await transfer.POST(req('POST', { toUserId: ID, newRole: 'manager', newTeamId: TEAM }));
    expect(res.status).toBe(204);
    expect(accountService.transferHead).toHaveBeenCalledWith(USER, { toUserId: ID, newRole: 'manager', newTeamId: TEAM });
  });

  it('GET teams → { teams }', async () => {
    accountService.listTeams.mockResolvedValue([{ id: TEAM, name: 'Team A', shortName: 'TA' }]);
    expect(await (await teams.GET()).json()).toEqual({ teams: [{ id: TEAM, name: 'Team A', shortName: 'TA' }] });
  });

  it('PATCH me → { user }', async () => {
    accountService.updateProfile.mockResolvedValue({ ...USER, fullName: 'H mới' });
    const res = await me.PATCH(req('PATCH', { fullName: ' H mới ' }));
    expect(await res.json()).toEqual({ user: { ...USER, fullName: 'H mới' } });
    expect(accountService.updateProfile).toHaveBeenCalledWith(USER, 'H mới');
  });
});
