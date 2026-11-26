// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const cookieStore = { get: () => ({ name: 'c', value: 'token' }), set: () => {} };
vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));

const authService = { authenticate: vi.fn() };
const reconcileService = { assertCanView: vi.fn(), view: vi.fn(), file: vi.fn() };
vi.mock('@ts24-htkh/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ts24-htkh/core')>()),
  getContainer: () => ({ authService, reconcileService }),
}));

const { AuthError, ForbiddenError } = await import('@ts24-htkh/core');
const view = await import('./reports/reconcile/route');
const file = await import('./reports/reconcile/file/route');

const USER = { id: 'u1', email: 'm@example.com', fullName: 'M', role: 'head', teamId: null };
const get = (q = '?from=2026-10-16&to=2026-11-15') => new Request(`http://localhost/api/v1/x${q}`);
const FN = 'HTKH - Đối soát KPI 16.10.2026-15.11.2026.xlsx';

beforeEach(() => {
  vi.resetAllMocks();
  authService.authenticate.mockResolvedValue(USER);
});

describe('reconcile routes', () => {
  it.each<[string, () => Promise<Response>]>([
    ['view', () => view.GET(get())],
    ['file', () => file.GET(get())],
  ])('401 khi chưa đăng nhập: %s', async (_n, call) => {
    authService.authenticate.mockRejectedValue(new AuthError('Chưa đăng nhập'));
    expect((await call()).status).toBe(401);
    for (const fn of Object.values(reconcileService)) expect(fn).not.toHaveBeenCalled();
  });

  it.each<[string, () => Promise<Response>]>([
    ['view', () => view.GET(get('?from=x&to=y'))],
    ['file', () => file.GET(get('?from=x&to=y'))],
  ])('403 Quản lý cả khi query sai: %s', async (_n, call) => {
    reconcileService.assertCanView.mockImplementation(() => {
      throw new ForbiddenError('Không có quyền');
    });
    expect((await call()).status).toBe(403);
    expect(reconcileService.view).not.toHaveBeenCalled();
    expect(reconcileService.file).not.toHaveBeenCalled();
  });

  it.each<[string, string]>([
    ['to < from', '?from=2026-11-15&to=2026-10-16'],
    ['quá 400 ngày', '?from=2025-01-01&to=2026-11-15'],
    ['thiếu to', '?from=2026-10-16'],
  ])('400 khoảng sai (%s)', async (_n, q) => {
    for (const call of [view.GET, file.GET]) {
      expect((await call(get(q))).status).toBe(400);
    }
    expect(reconcileService.view).not.toHaveBeenCalled();
    expect(reconcileService.file).not.toHaveBeenCalled();
  });

  it('200 Trưởng phòng trả { reconcile }', async () => {
    reconcileService.view.mockResolvedValue({ rows: [] });
    const res = await view.GET(get());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reconcile: { rows: [] } });
    expect(reconcileService.view).toHaveBeenCalledWith(USER, { from: '2026-10-16', to: '2026-11-15' });
  });

  it('file: header xlsx, filename ASCII và filename* UTF-8', async () => {
    reconcileService.file.mockResolvedValue({ fileName: FN, bytes: new Uint8Array([0x50, 0x4b]) });
    const res = await file.GET(get());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.headers.get('cache-control')).toBe('no-store');
    const cd = res.headers.get('content-disposition') ?? '';
    expect(cd).toBe(
      `attachment; filename="HTKH - Doi soat KPI 16.10.2026-15.11.2026.xlsx"; filename*=UTF-8''${encodeURIComponent(FN)}`,
    );
    expect(cd).toContain("filename*=UTF-8''HTKH%20-%20%C4%90%E1%BB%91i%20so%C3%A1t%20KPI%20");
    expect(new Uint8Array(await res.arrayBuffer())[0]).toBe(0x50);
  });
});
