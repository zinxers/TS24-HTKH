import { describe, expect, it } from 'vitest';
import { schemas } from './auth';

describe('schemas.login', () => {
  it('cắt khoảng trắng email', () => {
    expect(schemas.login.parse({ email: '  a@b.vn ', password: 'x' })).toEqual({ email: 'a@b.vn', password: 'x' });
  });

  it.each([
    ['mật khẩu rỗng', { email: 'a@b.vn', password: '' }],
    ['mật khẩu 129 ký tự', { email: 'a@b.vn', password: 'a'.repeat(129) }],
    ['thiếu email', { password: 'x' }],
    ['email không phải chuỗi', { email: 123, password: 'x' }],
  ])('từ chối %s', (_name, input) => {
    expect(schemas.login.safeParse(input).success).toBe(false);
  });
});
