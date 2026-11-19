// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const cookieStore = { get: () => ({ name: 'c', value: 'token' }), set: () => {} };
vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));

const authService = { authenticate: vi.fn() };
const kpiReportService = { submit: vi.fn(), mine: vi.fn() };
const kpiRateService = { list: vi.fn(), set: vi.fn() };
vi.mock('@ts24-htkh/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ts24-htkh/core')>()),
  getContainer: () => ({ authService, kpiReportService, kpiRateService }),
}));

const { AuthError, ForbiddenError } = await import('@ts24-htkh/core');
const { KENH } = await import('@ts24-htkh/shared');
const reports = await import('./kpi-reports/route');
const mine = await import('./kpi-reports/mine/route');
const rates = await import('./kpi-rates/route');

const USER = { id: 'u1', email: 's@example.com', fullName: 'S', role: 'staff', teamId: null };
const req = (method: string, body?: unknown, url = 'http://localhost/api/v1/x') =>
  new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
const mineUrl = (q: string) => `http://localhost/api/v1/kpi-reports/mine${q}`;
const RATES = Object.fromEntries(KENH.map((k) => [k, 1000]));

beforeEach(() => {
  vi.resetAllMocks();
  authService.authenticate.mockResolvedValue(USER);
});

describe('401 khi chưa đăng nhập', () => {
  const cases: [string, () => Promise<Response>][] = [
    ['POST kpi-reports', () => reports.POST(req('POST', { rows: [{}] }))],
    ['GET mine', () => mine.GET(req('GET', undefined, mineUrl('?from=2026-11-01&to=2026-11-02')))],
    ['GET kpi-rates', () => rates.GET()],
    ['PUT kpi-rates', () => rates.PUT(req('PUT', { from: '2026-12-01', rates: RATES }))],
  ];
  it.each(cases)('%s', async (_n, call) => {
    authService.authenticate.mockRejectedValue(new AuthError('Chưa đăng nhập'));
    expect((await call()).status).toBe(401);
  });
});

describe('POST /kpi-reports', () => {
  it.each([['không phải JSON', 'x{'], ['rows không phải mảng', { rows: 'a' }], ['rows rỗng', { rows: [] }]])(
    '400 khi %s',
    async (_n, body) => {
      expect((await reports.POST(req('POST', body))).status).toBe(400);
      expect(kpiReportService.submit).not.toHaveBeenCalled();
    },
  );

  it('phần tử rác: 200 và chuyển nguyên rows cho service', async () => {
    const rows = [null, 5, 'x', [], { rowId: 1 }];
    const result = { createdAt: 't', results: [] };
    kpiReportService.submit.mockResolvedValue(result);
    const res = await reports.POST(req('POST', { rows }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(result);
    expect(kpiReportService.submit).toHaveBeenCalledWith(USER, rows);
  });
});

describe('GET /kpi-reports/mine', () => {
  it.each(['', '?from=2026-11-01', '?from=bad&to=2026-11-02', '?from=2026-11-05&to=2026-11-01'])(
    '400 với query %s',
    async (q) => {
      expect((await mine.GET(req('GET', undefined, mineUrl(q)))).status).toBe(400);
      expect(kpiReportService.mine).not.toHaveBeenCalled();
    },
  );

  it('200 { kpi }', async () => {
    kpiReportService.mine.mockResolvedValue({ total: 1 });
    const res = await mine.GET(req('GET', undefined, mineUrl('?from=2026-11-01&to=2026-11-02')));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ kpi: { total: 1 } });
    expect(kpiReportService.mine).toHaveBeenCalledWith(USER, { from: '2026-11-01', to: '2026-11-02' });
  });
});

describe('/kpi-rates', () => {
  it('GET 200 { versions }', async () => {
    kpiRateService.list.mockResolvedValue([{ from: '2026-01-01' }]);
    const res = await rates.GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ versions: [{ from: '2026-01-01' }] });
  });

  it('PUT 400 khi body sai', async () => {
    expect((await rates.PUT(req('PUT', { from: 'x' }))).status).toBe(400);
    expect((await rates.PUT(req('PUT', 'x{'))).status).toBe(400);
    expect(kpiRateService.set).not.toHaveBeenCalled();
  });

  it('PUT 403 khi không phải Trưởng phòng', async () => {
    kpiRateService.set.mockRejectedValue(new ForbiddenError('Chỉ Trưởng phòng được đổi đơn giá'));
    const res = await rates.PUT(req('PUT', { from: '2026-12-01', rates: RATES }));
    expect(res.status).toBe(403);
    expect((await res.json()).error.message).toBe('Chỉ Trưởng phòng được đổi đơn giá');
  });

  it('PUT 200 { versions }', async () => {
    kpiRateService.set.mockResolvedValue([{ from: '2026-12-01' }]);
    const res = await rates.PUT(req('PUT', { from: '2026-12-01', rates: RATES }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ versions: [{ from: '2026-12-01' }] });
    expect(kpiRateService.set).toHaveBeenCalledWith(USER, { from: '2026-12-01', rates: RATES });
  });
});
