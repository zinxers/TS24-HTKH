// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

const { AuthError } = await import('@ts24-htkh/core');
const { schemas } = await import('@ts24-htkh/shared');
const { handle } = await import('./handle');

describe('handle', () => {
  it('AppError → mã HTTP và JSON lỗi', async () => {
    const res = await handle(async () => {
      throw new AuthError('x');
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: { code: 'AUTH', message: 'x' } });
  });

  it('ZodError → 400 VALIDATION', async () => {
    const res = await handle(async () => {
      schemas.login.parse({});
      return new Response();
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: { code: 'VALIDATION', message: 'Dữ liệu không hợp lệ' } });
  });

  it('lỗi lạ → 500, không lộ SQL hay stack', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await handle(async () => {
      throw new Error('select * from secret');
    });
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: { code: 'INTERNAL', message: 'Lỗi hệ thống, vui lòng thử lại' } });
    expect(text).not.toContain('select');
    expect(text).not.toContain('at ');
    spy.mockRestore();
  });

  it('trả nguyên response khi không lỗi', async () => {
    const res = await handle(async () => new Response(null, { status: 204 }));
    expect(res.status).toBe(204);
  });
});
