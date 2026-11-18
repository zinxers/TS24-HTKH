import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient } from './api-client';

const USER = { id: 'u1', email: 'a@b.vn', fullName: 'A', role: 'staff', teamId: 't1' };

function mockFetch(status: number, body?: unknown) {
  const fn = vi.fn(async () =>
    body === undefined ? new Response(null, { status }) : Response.json(body, { status }),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiClient tài khoản', () => {
  it('accounts.update gửi PATCH JSON, trả account', async () => {
    const fetch = mockFetch(200, { account: { id: 'a1' } });
    await expect(apiClient.accounts.update('a1', { fullName: 'B' })).resolves.toEqual({ id: 'a1' });
    expect(fetch).toHaveBeenCalledWith('/api/v1/accounts/a1', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fullName: 'B' }),
    });
  });

  it('accounts.remove gửi DELETE, 204 → undefined', async () => {
    const fetch = mockFetch(204);
    await expect(apiClient.accounts.remove('a1')).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith('/api/v1/accounts/a1', { method: 'DELETE', credentials: 'same-origin' });
  });

  it('teams.list trả mảng team', async () => {
    mockFetch(200, { teams: [{ id: 't', name: 'T' }] });
    await expect(apiClient.teams.list()).resolves.toEqual([{ id: 't', name: 'T' }]);
  });
});

describe('apiClient.auth', () => {
  it('login gửi JSON, credentials same-origin, trả user', async () => {
    const fetch = mockFetch(200, { user: USER });
    await expect(apiClient.auth.login({ email: 'a@b.vn', password: 'x' })).resolves.toEqual(USER);
    expect(fetch).toHaveBeenCalledWith('/api/v1/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.vn', password: 'x' }),
    });
  });

  it('401 → ApiError có code, status, message từ API', async () => {
    mockFetch(401, { error: { code: 'AUTH', message: 'm' } });
    const error = await apiClient.auth.me().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'AUTH', status: 401, message: 'm' });
  });

  it('lỗi không phải JSON → ApiError INTERNAL', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Bad Gateway', { status: 502 })));
    await expect(apiClient.auth.me()).rejects.toMatchObject({
      code: 'INTERNAL',
      status: 502,
      message: 'Lỗi hệ thống, vui lòng thử lại',
    });
  });

  it('logout 204 → không lỗi', async () => {
    const fetch = mockFetch(204);
    await expect(apiClient.auth.logout()).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith('/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin' });
  });
});
