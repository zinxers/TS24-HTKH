// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const cookieStore = { get: () => ({ name: 'c', value: 'token' }), set: () => {} };
vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));

const authService = { authenticate: vi.fn() };
const reportService = { preview: vi.fn(), notes: vi.fn(), saveNotes: vi.fn(), file: vi.fn() };
vi.mock('@ts24-htkh/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ts24-htkh/core')>()),
  getContainer: () => ({ authService, reportService }),
}));

const { AuthError, ForbiddenError } = await import('@ts24-htkh/core');
const preview = await import('./reports/[type]/route');
const notes = await import('./reports/[type]/notes/route');
const file = await import('./reports/[type]/file/route');

const USER = { id: 'u1', email: 'm@example.com', fullName: 'M', role: 'head', teamId: null };
const ctx = (type: string) => ({ params: Promise.resolve({ type }) });
const get = (q = '?start=2026-11-20') => new Request(`http://localhost/api/v1/x${q}`);
const put = (body: unknown) =>
  new Request('http://localhost/api/v1/x', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
const msg = async (res: Response) => (await res.json()).error.message;
const SAVE = { start: '2026-11-20', scope: 'dept', fields: { a: 'x' }, expectedVersion: null };

beforeEach(() => {
  vi.resetAllMocks();
  authService.authenticate.mockResolvedValue(USER);
});

describe('report routes', () => {
  it.each<[string, () => Promise<Response>]>([
    ['preview', () => preview.GET(get(), ctx('WR'))],
    ['notes', () => notes.PUT(put(SAVE), ctx('WR'))],
    ['file', () => file.GET(get(), ctx('WR'))],
  ])('401 khi chưa đăng nhập: %s', async (_n, call) => {
    authService.authenticate.mockRejectedValue(new AuthError('Chưa đăng nhập'));
    expect((await call()).status).toBe(401);
    for (const fn of Object.values(reportService)) expect(fn).not.toHaveBeenCalled();
  });

  it.each<[string, () => Promise<Response>, string]>([
    ['preview: type XR', () => preview.GET(get(), ctx('XR')), 'Loại báo cáo không hợp lệ'],
    ['preview: start sai', () => preview.GET(get('?start=x'), ctx('WR')), ''],
    ['notes: type XR', () => notes.PUT(put(SAVE), ctx('XR')), 'Loại báo cáo không hợp lệ'],
    ['notes: thiếu expectedVersion', () => notes.PUT(put({ start: SAVE.start, scope: 'dept', fields: {} }), ctx('WR')), ''],
    ['file: type XR', () => file.GET(get(), ctx('XR')), 'Loại báo cáo không hợp lệ'],
  ])('400: %s', async (_n, call, message) => {
    const res = await call();
    expect(res.status).toBe(400);
    if (message) expect(await msg(res)).toBe(message);
    for (const fn of Object.values(reportService)) expect(fn).not.toHaveBeenCalled();
  });

  it('403 từ service', async () => {
    reportService.preview.mockRejectedValue(new ForbiddenError('Không có quyền'));
    expect((await preview.GET(get(), ctx('WR'))).status).toBe(403);
  });

  it('500 chung khi lỗi lạ, không lộ message', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      reportService.preview.mockRejectedValue(new Error('Cần đúng 3 team để điền báo cáo'));
      const res = await preview.GET(get(), ctx('WR'));
      expect(res.status).toBe(500);
      expect(await msg(res)).not.toContain('3 team');
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('preview và notes trả dữ liệu', async () => {
    reportService.preview.mockResolvedValue({ type: 'WR' });
    const res = await preview.GET(get(), ctx('WR'));
    expect(await res.json()).toEqual({ preview: { type: 'WR' } });
    expect(reportService.preview).toHaveBeenCalledWith(USER, 'WR', '2026-11-20');
    reportService.saveNotes.mockResolvedValue({ scopes: [] });
    const res2 = await notes.PUT(put(SAVE), ctx('MR'));
    expect(await res2.json()).toEqual({ notes: { scopes: [] } });
    expect(reportService.saveNotes).toHaveBeenCalledWith(USER, 'MR', SAVE);
  });

  it('file: 3 header và body zip', async () => {
    reportService.file.mockResolvedValue({ fileName: 'WR.xlsx', bytes: new Uint8Array([0x50, 0x4b, 3, 4]) });
    const res = await file.GET(get(), ctx('WR'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="WR.xlsx"');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(new TextDecoder().decode(await res.arrayBuffer()).startsWith('PK')).toBe(true);
    expect(reportService.file).toHaveBeenCalledWith(USER, 'WR', '2026-11-20');
  });
});
