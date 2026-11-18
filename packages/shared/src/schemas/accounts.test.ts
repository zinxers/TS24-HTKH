import { describe, expect, it } from 'vitest';
import {
  accountCreateSchema,
  accountStatusSchema,
  accountUpdateSchema,
  profileUpdateSchema,
  setPasswordSchema,
  transferHeadSchema,
} from './accounts';

const TEAM = '6f1c2a2e-0b8e-4a37-9d6b-1f0a4f6f2c11';
const create = {
  email: 'a@example.com',
  fullName: 'Nguyễn Văn A',
  role: 'staff',
  teamId: TEAM,
  password: '12345678',
};

describe('accountCreateSchema', () => {
  it('chuẩn hóa email: bỏ khoảng trắng, chữ thường', () => {
    expect(accountCreateSchema.parse({ ...create, email: ' A@Example.com ' }).email).toBe('a@example.com');
  });

  it.each([
    ['mật khẩu 7 ký tự', { password: '1234567' }],
    ['mật khẩu 129 ký tự', { password: 'x'.repeat(129) }],
    ['role head', { role: 'head' }],
    ['họ tên toàn khoảng trắng', { fullName: '   ' }],
    ['email sai định dạng', { email: 'khong-phai-email' }],
    ['teamId không phải uuid', { teamId: 'abc' }],
  ])('từ chối %s', (_name, patch) => {
    expect(accountCreateSchema.safeParse({ ...create, ...patch }).success).toBe(false);
  });

  it('mật khẩu 8 và 128 ký tự đạt', () => {
    expect(accountCreateSchema.safeParse(create).success).toBe(true);
    expect(accountCreateSchema.safeParse({ ...create, password: 'x'.repeat(128) }).success).toBe(true);
  });
});

describe('accountUpdateSchema', () => {
  it('từ chối {} (phải có ít nhất một trường)', () => {
    expect(accountUpdateSchema.safeParse({}).success).toBe(false);
  });

  it('từ chối role head', () => {
    expect(accountUpdateSchema.safeParse({ role: 'head' }).success).toBe(false);
  });

  it('nhận một trường, trim họ tên', () => {
    expect(accountUpdateSchema.parse({ fullName: '  B  ' })).toEqual({ fullName: 'B' });
  });
});

describe('các schema khác', () => {
  it('status chỉ active | locked', () => {
    expect(accountStatusSchema.safeParse({ status: 'locked' }).success).toBe(true);
    expect(accountStatusSchema.safeParse({ status: 'deleted' }).success).toBe(false);
  });

  it('setPassword 8–128 ký tự', () => {
    expect(setPasswordSchema.safeParse({ password: '1234567' }).success).toBe(false);
    expect(setPasswordSchema.safeParse({ password: '12345678' }).success).toBe(true);
  });

  it('transferHead từ chối newRole head', () => {
    const ok = { toUserId: TEAM, newRole: 'manager', newTeamId: TEAM };
    expect(transferHeadSchema.safeParse(ok).success).toBe(true);
    expect(transferHeadSchema.safeParse({ ...ok, newRole: 'head' }).success).toBe(false);
  });

  it('profileUpdate từ chối họ tên rỗng', () => {
    expect(profileUpdateSchema.safeParse({ fullName: ' ' }).success).toBe(false);
    expect(profileUpdateSchema.parse({ fullName: ' C ' })).toEqual({ fullName: 'C' });
  });
});
