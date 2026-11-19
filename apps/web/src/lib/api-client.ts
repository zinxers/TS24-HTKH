import type {
  AccountCreateInput,
  AccountStatus,
  AccountUpdateInput,
  AccountView,
  CurrentUser,
  LoginInput,
  Team,
  TransferHeadInput,
} from '@ts24-htkh/shared';

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

const sendJson = (method: 'POST' | 'PATCH', body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
const postJson = (body: unknown) => sendJson('POST', body);
const patchJson = (body: unknown) => sendJson('PATCH', body);

/** Nơi duy nhất giao diện gọi API. */
export const apiClient = {
  auth: {
    login: async (input: LoginInput) =>
      (await request<{ user: CurrentUser }>('/auth/login', postJson(input))).user,
    logout: () => request<void>('/auth/logout', { method: 'POST' }),
    me: async () => (await request<{ user: CurrentUser }>('/auth/me')).user,
  },
  accounts: {
    list: async () => (await request<{ accounts: AccountView[] }>('/accounts')).accounts,
    create: async (input: AccountCreateInput) =>
      (await request<{ account: AccountView }>('/accounts', postJson(input))).account,
    update: async (id: string, input: AccountUpdateInput) =>
      (await request<{ account: AccountView }>(`/accounts/${id}`, patchJson(input))).account,
    setStatus: async (id: string, status: AccountStatus) =>
      (await request<{ account: AccountView }>(`/accounts/${id}/status`, patchJson({ status }))).account,
    remove: (id: string) => request<void>(`/accounts/${id}`, { method: 'DELETE' }),
    setPassword: (id: string, password: string) =>
      request<void>(`/accounts/${id}/password`, postJson({ password })),
    transferHead: (input: TransferHeadInput) => request<void>('/accounts/transfer-head', postJson(input)),
  },
  teams: {
    list: async () => (await request<{ teams: Team[] }>('/teams')).teams,
  },
  me: {
    updateProfile: async (fullName: string) =>
      (await request<{ user: CurrentUser }>('/me', patchJson({ fullName }))).user,
  },
};
