import { beforeEach, describe, expect, it, vi } from 'vitest';
import RootLayout from './layout';

const cookie = vi.hoisted(() => ({ value: undefined as string | undefined }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (name === 'theme' && cookie.value !== undefined ? { value: cookie.value } : undefined) }),
}));

beforeEach(() => {
  cookie.value = undefined;
});

describe('RootLayout: cookie theme → data-theme', () => {
  it.each([
    ['dark', 'dark'],
    ['light', 'light'],
  ])('cookie %s → data-theme=%s', async (v, out) => {
    cookie.value = v;
    const html = await RootLayout({ children: null });
    expect(html.props['data-theme']).toBe(out);
  });

  it.each([undefined, 'system', 'blue'])('cookie %s → không đặt data-theme (theo hệ thống)', async (v) => {
    cookie.value = v;
    const html = await RootLayout({ children: null });
    expect(html.props['data-theme']).toBeUndefined();
    expect(html.props.lang).toBe('vi');
  });
});
