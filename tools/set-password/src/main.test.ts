import { describe, expect, it, vi } from 'vitest';
import { NotFoundError, ValidationError } from '@ts24-htkh/core';
import { run } from './main';

const PASSWORD = 'mat-khau-bi-mat';

type SetPassword = (email: string, password: string) => Promise<void>;

function fakeIo(answers: string[], setPassword = vi.fn<SetPassword>(async () => {})) {
  const lines: string[] = [];
  return {
    lines,
    setPassword,
    io: {
      readHidden: vi.fn(async () => answers.shift() ?? ''),
      print: (line: string) => {
        lines.push(line);
      },
      setPassword,
    },
  };
}

describe('run', () => {
  it('không có email → in hướng dẫn, trả 1', async () => {
    const f = fakeIo([]);
    expect(await run([], f.io)).toBe(1);
    expect(f.lines.join('\n')).toContain('Cách dùng: pnpm --filter @ts24-htkh/set-password start <email>');
  });

  it('có mật khẩu trên dòng lệnh → từ chối, trả 1', async () => {
    const f = fakeIo([]);
    expect(await run(['a@b.vn', PASSWORD], f.io)).toBe(1);
    expect(f.setPassword).not.toHaveBeenCalled();
    expect(f.io.readHidden).not.toHaveBeenCalled();
  });

  it('hai lần nhập khác nhau → báo, trả 1', async () => {
    const f = fakeIo([PASSWORD, 'khac']);
    expect(await run(['a@b.vn'], f.io)).toBe(1);
    expect(f.lines).toContain('Hai lần nhập mật khẩu không khớp');
    expect(f.setPassword).not.toHaveBeenCalled();
  });

  it.each([
    new ValidationError('Mật khẩu phải dài 8 đến 128 ký tự'),
    new NotFoundError('Không tìm thấy tài khoản với email này'),
  ])('setPassword ném $name → in message, trả 1', async (error) => {
    const f = fakeIo(['ngan', 'ngan'], vi.fn(async () => Promise.reject(error)));
    expect(await run(['a@b.vn'], f.io)).toBe(1);
    expect(f.lines).toContain(error.message);
  });

  it('thành công → in xác nhận, trả 0, không in mật khẩu', async () => {
    const f = fakeIo([PASSWORD, PASSWORD]);
    expect(await run(['a@b.vn'], f.io)).toBe(0);
    expect(f.setPassword).toHaveBeenCalledWith('a@b.vn', PASSWORD);
    expect(f.lines).toContain('Đã đặt mật khẩu cho a@b.vn, các phiên cũ đã bị đăng xuất');
    expect(f.lines.join('\n')).not.toContain(PASSWORD);
  });
});
