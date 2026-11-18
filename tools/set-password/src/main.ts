import { AppError, getContainer } from '@ts24-htkh/core';
import { readHidden } from './read-hidden';

export interface Io {
  readHidden(prompt: string): Promise<string>;
  print(line: string): void;
  setPassword(email: string, password: string): Promise<void>;
}

const USAGE = 'Cách dùng: pnpm --filter @ts24-htkh/set-password start <email>';

/** Trả mã thoát. Không nhận mật khẩu qua tham số để không lưu vào lịch sử shell. */
export async function run(args: string[], io: Io): Promise<number> {
  const [email, ...rest] = args;
  if (!email || rest.length > 0) {
    if (rest.length > 0) io.print('Không nhập mật khẩu trên dòng lệnh; lệnh sẽ hỏi mật khẩu.');
    io.print(USAGE);
    return 1;
  }

  const password = await io.readHidden('Mật khẩu mới: ');
  const again = await io.readHidden('Nhập lại mật khẩu: ');
  if (password !== again) {
    io.print('Hai lần nhập mật khẩu không khớp');
    return 1;
  }

  try {
    await io.setPassword(email, password);
  } catch (error) {
    if (error instanceof AppError) {
      io.print(error.message);
      return 1;
    }
    throw error;
  }
  io.print(`Đã đặt mật khẩu cho ${email.trim().toLowerCase()}, các phiên cũ đã bị đăng xuất`);
  return 0;
}

if (import.meta.main) {
  process.exitCode = await run(process.argv.slice(2), {
    readHidden,
    print: (line) => console.log(line),
    setPassword: (email, password) => getContainer().authService.setPassword(email, password),
  });
  process.exit();
}
