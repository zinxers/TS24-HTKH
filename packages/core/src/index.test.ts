import { afterEach, expect, it, vi } from 'vitest';
import { PACKAGE_NAME } from './index';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it('xuất đúng tên package', () => {
  expect(PACKAGE_NAME).toBe('@ts24-htkh/core');
});

it('import không cần env; chỉ lỗi khi gọi getContainer', async () => {
  vi.stubEnv('DATABASE_URL', '');
  vi.stubEnv('SESSION_SECRET', '');
  const core = await import('./index');
  expect(core.SESSION_COOKIE).toBe('__Host-ts24-htkh-session');
  expect(() => core.getContainer()).toThrow('Thiếu biến môi trường DATABASE_URL');
});
