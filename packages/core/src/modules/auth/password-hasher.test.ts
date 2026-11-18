import { describe, expect, it } from 'vitest';
import { Argon2PasswordHasher, DUMMY_HASH } from './password-hasher';

const hasher = new Argon2PasswordHasher();

describe('Argon2PasswordHasher', () => {
  it('verify đúng mật khẩu đã băm', async () => {
    const phc = await hasher.hash('matkhau-dev-ts24');
    expect(phc.startsWith('$argon2id$v=19$m=19456,t=2,p=1$')).toBe(true);
    expect(await hasher.verify('matkhau-dev-ts24', phc)).toBe(true);
    expect(await hasher.verify('matkhau-khac', phc)).toBe(false);
  });

  it('hai lần băm cùng mật khẩu cho kết quả khác nhau', async () => {
    expect(await hasher.hash('abc')).not.toBe(await hasher.hash('abc'));
  });

  it('chuỗi hỏng trả false, không ném', async () => {
    expect(await hasher.verify('x', 'rác')).toBe(false);
    expect(await hasher.verify('x', '$argon2id$v=19$m=19456,t=2,p=1$abc')).toBe(false);
  });

  it('DUMMY_HASH hợp lệ nhưng không khớp mật khẩu nào', async () => {
    expect(DUMMY_HASH.startsWith('$argon2id$v=19$m=19456,t=2,p=1$')).toBe(true);
    expect(await hasher.verify('bất kỳ', DUMMY_HASH)).toBe(false);
  });
});
