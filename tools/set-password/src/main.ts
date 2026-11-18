import { AppError, getContainer, getEnv } from '@ts24-htkh/core';
import { InputCancelledError, readHidden } from './read-hidden';

export interface Io {
  /** false khi stdin không phải TTY (vd Git Bash/mintty): terminal sẽ hiện mật khẩu. */
  canHideInput: boolean;
  /** Lỗi cấu hình (thiếu DATABASE_URL, SESSION_SECRET…) hoặc null nếu đủ. */
  checkEnv(): string | null;
  /** host:port của DATABASE_URL, in ra để người vận hành kiểm đúng môi trường. */
  target: string;
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
  if (!io.canHideInput) {
    io.print('Terminal này không ẩn được ký tự khi nhập mật khẩu (vd Git Bash). Chạy lệnh trong PowerShell hoặc cmd.');
    return 1;
  }
  // Kiểm trước khi hỏi mật khẩu, để không bắt người dùng gõ xong mới báo lỗi.
  const envProblem = io.checkEnv();
  if (envProblem) {
    io.print(envProblem);
    io.print('Đặt DATABASE_URL và SESSION_SECRET rồi chạy lại (xem docs/runbooks/dat-mat-khau.md).');
    return 1;
  }
  io.print(`Cơ sở dữ liệu: ${io.target}`);

  let password: string;
  let again: string;
  try {
    password = await io.readHidden('Mật khẩu mới: ');
    again = await io.readHidden('Nhập lại mật khẩu: ');
  } catch (error) {
    if (error instanceof InputCancelledError) {
      io.print('Đã hủy');
      return 130;
    }
    throw error;
  }
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
    canHideInput: process.stdin.isTTY === true,
    checkEnv: () => {
      try {
        getEnv();
        return null;
      } catch (error) {
        return error instanceof Error ? error.message : 'Cấu hình không hợp lệ';
      }
    },
    // Chỉ host:port, không in user/mật khẩu trong chuỗi kết nối.
    target: URL.parse(process.env.DATABASE_URL ?? '')?.host || 'không rõ',
    readHidden: (prompt) => readHidden(prompt),
    print: (line) => console.log(line),
    setPassword: (email, password) => getContainer().authService.setPassword(email, password),
  });
  process.exit();
}
