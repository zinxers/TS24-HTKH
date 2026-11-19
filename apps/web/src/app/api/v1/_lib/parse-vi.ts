import { ValidationError } from '@ts24-htkh/core';

interface Parseable<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false; error: { issues: { message: string }[] } };
}

/** Như schema.parse nhưng giữ thông báo tiếng Việt đầu tiên của schema (handle() chỉ trả thông báo chung cho ZodError). */
export function parseVi<T>(schema: Parseable<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationError(result.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ');
  return result.data;
}
