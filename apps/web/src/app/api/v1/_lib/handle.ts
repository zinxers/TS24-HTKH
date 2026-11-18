import { AppError } from '@ts24-htkh/core';

const errorJson = (status: number, code: string, message: string) =>
  Response.json({ error: { code, message } }, { status });

/** Bọc route: AppError → mã HTTP; ZodError → 400; lỗi khác → 500, không lộ chi tiết. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AppError) return errorJson(error.status, error.code, error.message);
    if (error instanceof Error && error.name === 'ZodError') {
      return errorJson(400, 'VALIDATION', 'Dữ liệu không hợp lệ');
    }
    // Chỉ in tên và stack: không in body request (có thể chứa mật khẩu).
    console.error(error instanceof Error ? `${error.name}\n${error.stack}` : 'Lỗi không rõ');
    return errorJson(500, 'INTERNAL', 'Lỗi hệ thống, vui lòng thử lại');
  }
}
