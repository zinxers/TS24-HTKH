import { ValidationError } from '@ts24-htkh/core';

/** Đọc body JSON; JSON hỏng → 400 như body sai schema. */
export function readJson(req: Request): Promise<unknown> {
  return req.json().catch(() => {
    throw new ValidationError('Dữ liệu không hợp lệ');
  });
}
