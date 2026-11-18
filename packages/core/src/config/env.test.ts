import { expect, it } from 'vitest';
import { getEnv } from './env';

const secret = 'a'.repeat(32);

it('trả đủ biến', () => {
  expect(getEnv({ DATABASE_URL: 'postgres://x', SESSION_SECRET: secret })).toEqual({
    databaseUrl: 'postgres://x',
    sessionSecret: secret,
  });
});

it('thiếu DATABASE_URL thì báo tên biến', () => {
  expect(() => getEnv({ SESSION_SECRET: secret })).toThrow('Thiếu biến môi trường DATABASE_URL');
});

it('thiếu SESSION_SECRET thì báo tên biến', () => {
  expect(() => getEnv({ DATABASE_URL: 'postgres://x' })).toThrow('Thiếu biến môi trường SESSION_SECRET');
});

it('SESSION_SECRET 31 byte thì lỗi', () => {
  expect(() => getEnv({ DATABASE_URL: 'postgres://x', SESSION_SECRET: 'a'.repeat(31) })).toThrow(
    'SESSION_SECRET phải dài ít nhất 32 byte',
  );
});
