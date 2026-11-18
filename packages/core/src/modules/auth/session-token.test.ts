import { expect, it } from 'vitest';
import { hashToken, newToken } from './session-token';

it('newToken dài 43 ký tự base64url, mỗi lần khác nhau', () => {
  const a = newToken();
  expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(newToken()).not.toBe(a);
});

it('hashToken ổn định, 64 hex, phụ thuộc secret', () => {
  const s = 's'.repeat(32);
  expect(hashToken('a', s)).toBe(hashToken('a', s));
  expect(hashToken('a', s)).toMatch(/^[0-9a-f]{64}$/);
  expect(hashToken('a', 't'.repeat(32))).not.toBe(hashToken('a', s));
});
