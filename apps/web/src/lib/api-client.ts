import type {
  AccountCreateInput,
  AccountStatus,
  AccountUpdateInput,
  AccountView,
  CurrentUser,
  DeptOverview,
  IsoDate,
  KpiSubmitResult,
  KpiTrend,
  LoginInput,
  MyKpi,
  RateSetInput,
  RateVersion,
  ReportNotes,
  ReportNoteSaveInput,
  ReportPreview,
  ReportType,
  Team,
  TeamKpi,
  TeamMemberKpi,
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

const sendJson = (method: 'POST' | 'PATCH' | 'PUT', body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
const postJson = (body: unknown) => sendJson('POST', body);
const patchJson = (body: unknown) => sendJson('PATCH', body);
const putJson = (body: unknown) => sendJson('PUT', body);

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
  kpi: {
    /** `rows` là các dòng thô của form; server kiểm từng dòng. */
    submit: (rows: unknown[]) => request<KpiSubmitResult>('/kpi-reports', postJson({ rows })),
    mine: async (range: { from: IsoDate; to: IsoDate }) =>
      (await request<{ kpi: MyKpi }>(`/kpi-reports/mine?from=${range.from}&to=${range.to}`)).kpi,
    team: async (teamId: string, range: { from: IsoDate; to: IsoDate }) =>
      (await request<{ report: TeamKpi }>(`/teams/${teamId}/kpi?from=${range.from}&to=${range.to}`)).report,
    member: async (teamId: string, userId: string, range: { from: IsoDate; to: IsoDate }) =>
      (
        await request<{ member: TeamMemberKpi }>(
          `/teams/${teamId}/kpi/members/${userId}?from=${range.from}&to=${range.to}`,
        )
      ).member,
    overview: async (range: { from: IsoDate; to: IsoDate }) =>
      (await request<{ overview: DeptOverview }>(`/kpi-reports/overview?from=${range.from}&to=${range.to}`)).overview,
    trend: async (team: string, unit: 'week' | 'month') =>
      (await request<{ trend: KpiTrend }>(`/kpi-reports/trend?team=${team}&unit=${unit}`)).trend,
    rates: async () => (await request<{ versions: RateVersion[] }>('/kpi-rates')).versions,
    setRates: async (input: RateSetInput) =>
      (await request<{ versions: RateVersion[] }>('/kpi-rates', putJson(input))).versions,
  },
  reports: {
    preview: async (type: ReportType, start: IsoDate) =>
      (await request<{ preview: ReportPreview }>(`/reports/${type}?start=${start}`)).preview,
    saveNotes: async (type: ReportType, input: ReportNoteSaveInput) =>
      (await request<{ notes: ReportNotes }>(`/reports/${type}/notes`, putJson(input))).notes,
    /** URL tải .xlsx; dùng cho thẻ tải/Platform, không qua request(). */
    fileUrl: (type: ReportType, start: IsoDate) => `/api/v1/reports/${type}/file?start=${start}`,
  },
  me: {
    updateProfile: async (fullName: string) =>
      (await request<{ user: CurrentUser }>('/me', patchJson({ fullName }))).user,
  },
};
