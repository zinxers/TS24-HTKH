import { DEPT_SCOPE, type ReportNoteScope, type ReportPreview, type ReportType, type Team } from '@ts24-htkh/shared';
import { reportPeriods } from '@ts24-htkh/shared';

export const TODAY = '2026-11-23';
export const TEAMS: Team[] = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Thuế, Kế toán và Hệ thống quản lý', shortName: 'TaxOnline' },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Bảo hiểm xã hội và Quản lý nhân sự', shortName: 'iBHXH' },
  { id: '33333333-3333-4333-8333-333333333333', name: 'Hóa đơn điện tử, Hải quan và Chuyển đổi số', shortName: 'iXHD' },
];

export const scopeNote = (scope: string, over: Partial<ReportNoteScope> = {}): ReportNoteScope => ({
  scope,
  fields: {},
  version: null,
  updatedAt: null,
  updatedByName: null,
  ...over,
});

/** Trưởng phòng: 3 cột + 4 phạm vi; `managerTeam` thì chỉ cột và phạm vi của team đó. */
export function preview(type: ReportType, start: string, opts: { managerTeam?: number; scopes?: ReportNoteScope[] } = {}): ReportPreview {
  const period = reportPeriods(type, TODAY as never).find((p) => p.start === start) ?? reportPeriods(type, TODAY as never)[1]!;
  const m = opts.managerTeam;
  const teams = TEAMS.map((t, i) => (m === undefined || m === i ? t : null));
  const v = (n: number) => teams.map((t) => (t ? n : null));
  return {
    type,
    period,
    teams,
    total: 1234,
    trend: type === 'MR' ? '↑' : null,
    rows: type === 'WR' ? [{ label: 'Tổng đài (ĐT)', values: v(120) }, { label: 'Hoàn thành', values: v(375) }] : type === 'QR' ? [{ label: 'Ticket xử lý / nhân sự', values: v(412.3) }] : [],
    notes: {
      scopes: opts.scopes ?? (m === undefined ? [DEPT_SCOPE, ...TEAMS.map((t) => t.id)].map((s) => scopeNote(s)) : [scopeNote(TEAMS[m]!.id)]),
    },
  };
}
