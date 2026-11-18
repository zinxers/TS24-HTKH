import { describe, expect, it, vi } from 'vitest';
import { NotFoundError, ValidationError } from '@ts24-htkh/core';
import { run } from './main';
import { InputCancelledError } from './read-hidden';

const PASSWORD = 'mat-khau-bi-mat';

type SetPassword = (email: string, password: string) => Promise<void>;

function fakeIo(answers: string[], setPassword = vi.fn<SetPassword>(async () => {})) {
  const lines: string[] = [];
  return {
    lines,
    setPassword,
    io: {
      canHideInput: true,
      checkEnv: (): string | null => null,
      target: '127.0.0.1:54322',
      readHidden: vi.fn(async () => answers.shift() ?? ''),
      print: (line: string) => {
        lines.push(line);
      },
      setPassword,
    },
  };
}

describe('run', () => {
  it('terminal không ẩn được ký tự → từ chối trước khi hỏi mật khẩu, trả 1', async () => {
    const f = fakeIo([PASSWORD, PASSWORD]);
    f.io.canHideInput = false;
    expect(await run(['a@b.vn'], f.io)).toBe(1);
    expect(f.lines.join('\n')).toContain('Chạy lệnh trong PowerShell hoặc cmd');
    expect(f.io.readHidden).not.toHaveBeenCalled();
  });

  it('thiếu biến môi trường → báo rõ và chỉ cách đặt, trước khi hỏi mật khẩu, trả 1', async () => {
    const f = fakeIo([PASSWORD, PASSWORD]);
    f.io.checkEnv = () => 'Thiếu biến môi trường DATABASE_URL';
    expect(await run(['a@b.vn'], f.io)).toBe(1);
    const out = f.lines.join('\n');
    expect(out).toContain('Thiếu biến môi trường DATABASE_URL');
    expect(out).toContain('docs/runbooks/dat-mat-khau.md');
    expect(f.io.readHidden).not.toHaveBeenCalled();
  });

  it('in máy chủ DB đích trước khi hỏi mật khẩu', async () => {
    const f = fakeIo([PASSWORD, PASSWORD]);
    f.io.readHidden.mockImplementation(async () => {
      expect(f.lines).toContain('Cơ sở dữ liệu: 127.0.0.1:54322');
      return PASSWORD;
    });
    expect(await run(['a@b.vn'], f.io)).toBe(0);
  });

  it('Ctrl+C hoặc hết dữ liệu nhập → in Đã hủy, trả 130', async () => {
    const f = fakeIo([]);
    f.io.readHidden.mockRejectedValueOnce(new InputCancelledError());
    expect(await run(['a@b.vn'], f.io)).toBe(130);
    expect(f.lines).toContain('Đã hủy');
    expect(f.setPassword).not.toHaveBeenCalled();
  });

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
