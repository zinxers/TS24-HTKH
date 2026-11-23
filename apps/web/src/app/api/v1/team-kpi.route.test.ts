// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const cookieStore = { get: () => ({ name: 'c', value: 'token' }), set: () => {} };
vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));

const authService = { authenticate: vi.fn() };
const teamKpiService = { report: vi.fn(), member: vi.fn(), overview: vi.fn(), trend: vi.fn() };
vi.mock('@ts24-htkh/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ts24-htkh/core')>()),
  getContainer: () => ({ authService, teamKpiService }),
}));

const { AuthError, ForbiddenError, NotFoundError } = await import('@ts24-htkh/core');
const team = await import('./teams/[id]/kpi/route');
const member = await import('./teams/[id]/kpi/members/[userId]/route');
const overview = await import('./kpi-reports/overview/route');
const trend = await import('./kpi-reports/trend/route');

const USER = { id: 'u1', email: 'm@example.com', fullName: 'M', role: 'manager', teamId: null };
const TEAM = '11111111-1111-4111-8111-111111111111';
const UID = '22222222-2222-4222-8222-222222222222';
const RANGE = '?from=2026-11-01&to=2026-11-15';
const req = (q: string) => new Request(`http://localhost/api/v1/x${q}`);
const teamCall = (id = TEAM, q = RANGE) => team.GET(req(q), { params: Promise.resolve({ id }) });
const memberCall = (id = TEAM, userId = UID, q = RANGE) =>
  member.GET(req(q), { params: Promise.resolve({ id, userId }) });
const msg = async (res: Response) => (await res.json()).error.message;

beforeEach(() => {
  vi.resetAllMocks();
  authService.authenticate.mockResolvedValue(USER);
});

describe('team-kpi routes', () => {
  it.each<[string, () => Promise<Response>]>([
    ['team', () => teamCall()],
    ['member', () => memberCall()],
    ['overview', () => overview.GET(req(RANGE))],
    ['trend', () => trend.GET(req('?team=all&unit=week'))],
  ])('401 khi chưa đăng nhập: %s', async (_n, call) => {
    authService.authenticate.mockRejectedValue(new AuthError('Chưa đăng nhập'));
    expect((await call()).status).toBe(401);
    for (const fn of Object.values(teamKpiService)) expect(fn).not.toHaveBeenCalled();
  });

  it.each<[string, () => Promise<Response>, string]>([
    ['team: from sai', () => teamCall(TEAM, '?from=x&to=2026-11-15'), ''],
    ['team: id không phải uuid', () => teamCall('abc'), 'Team không hợp lệ'],
    ['member: userId không phải uuid', () => memberCall(TEAM, 'abc'), 'Không tìm thấy thành viên'],
    ['member: team sai', () => memberCall('abc'), 'Team không hợp lệ'],
    ['member: from sai', () => memberCall(TEAM, UID, '?from=x&to=y'), ''],
    ['overview: from sai', () => overview.GET(req('?from=x&to=2026-11-15')), ''],
    ['trend: unit=day', () => trend.GET(req('?team=all&unit=day')), 'Kỳ không hợp lệ'],
    ['trend: team sai', () => trend.GET(req('?team=abc&unit=week')), 'Team không hợp lệ'],
  ])('400: %s', async (_n, call, message) => {
    const res = await call();
    expect(res.status).toBe(400);
    if (message) expect(await msg(res)).toBe(message);
    for (const fn of Object.values(teamKpiService)) expect(fn).not.toHaveBeenCalled();
  });

  it('403 và 404 từ service được chuyển nguyên', async () => {
    teamKpiService.report.mockRejectedValue(new ForbiddenError('Bạn không có quyền xem báo cáo team'));
    const res = await teamCall();
    expect(res.status).toBe(403);
    expect(await msg(res)).toBe('Bạn không có quyền xem báo cáo team');
    teamKpiService.overview.mockRejectedValue(new ForbiddenError('Chỉ Trưởng phòng được xem tổng quan phòng'));
    expect((await overview.GET(req(RANGE))).status).toBe(403);
    teamKpiService.member.mockRejectedValue(new NotFoundError('Không tìm thấy thành viên'));
    expect((await memberCall()).status).toBe(404);
  });

  it('thành công: đúng dạng body và tham số chuyển nguyên', async () => {
    const range = { from: '2026-11-01', to: '2026-11-15' };
    teamKpiService.report.mockResolvedValue({ r: 1 });
    teamKpiService.member.mockResolvedValue({ m: 1 });
    teamKpiService.overview.mockResolvedValue({ o: 1 });
    teamKpiService.trend.mockResolvedValue({ t: 1 });
    expect(await (await teamCall()).json()).toEqual({ report: { r: 1 } });
    expect(teamKpiService.report).toHaveBeenCalledWith(USER, TEAM, range);
    expect(await (await memberCall()).json()).toEqual({ member: { m: 1 } });
    expect(teamKpiService.member).toHaveBeenCalledWith(USER, TEAM, UID, range);
    expect(await (await overview.GET(req(RANGE))).json()).toEqual({ overview: { o: 1 } });
    expect(teamKpiService.overview).toHaveBeenCalledWith(USER, range);
    expect(await (await trend.GET(req(`?team=${TEAM}&unit=month`))).json()).toEqual({ trend: { t: 1 } });
    expect(teamKpiService.trend).toHaveBeenCalledWith(USER, TEAM, 'month');
  });
});
