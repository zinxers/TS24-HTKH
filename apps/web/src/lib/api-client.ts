import type { CurrentUser, LoginInput } from '@ts24-htkh/shared';

/** Lỗi từ API: code và message lấy nguyên từ JSON `{ error: { code, message } }`. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/v1${path}`, { ...init, credentials: 'same-origin' });
  if (res.status === 204) return undefined as T;
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw error?.code && error.message
      ? new ApiError(error.code, res.status, error.message)
      : new ApiError('INTERNAL', res.status, 'Lỗi hệ thống, vui lòng thử lại');
  }
  return body as T;
}

const postJson = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

/** Nơi duy nhất giao diện gọi API. */
export const apiClient = {
  auth: {
    login: async (input: LoginInput) =>
      (await request<{ user: CurrentUser }>('/auth/login', postJson(input))).user,
    logout: () => request<void>('/auth/logout', { method: 'POST' }),
    me: async () => (await request<{ user: CurrentUser }>('/auth/me')).user,
  },
};
