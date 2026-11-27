import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserMenu } from '../../../features/profile/UserMenu';
import AppLayout from './layout';

const cookie = vi.hoisted(() => ({ value: undefined as string | undefined }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (name === 'sidebar' && cookie.value !== undefined ? { value: cookie.value } : undefined) }),
}));

beforeEach(() => {
  cookie.value = undefined;
});

describe('(app)/layout: cookie thanh bên → AppShell', () => {
  it.each([
    ['collapsed', true],
    [undefined, false],
    ['abc', false],
  ])('cookie %s → initialCollapsed=%s', async (v, out) => {
    cookie.value = v;
    const el = await AppLayout({ children: null });
    expect(el.props.initialCollapsed).toBe(out);
  });

  it('truyền UserMenu vào khung', async () => {
    const el = await AppLayout({ children: null });
    expect(el.props.userMenu.type).toBe(UserMenu);
  });
});
