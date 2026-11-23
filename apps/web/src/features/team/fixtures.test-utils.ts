import { KENH, PHAN_LOAI, type DeptOverview, type KenhCounts, type KpiTrend, type PhanLoaiCounts, type Team, type TeamKpi, type TeamKpiRow } from '@ts24-htkh/shared';

export const TEAMS: Team[] = [
  { id: 't1', name: 'Thuế, Kế toán và Hệ thống quản lý', shortName: 'TaxOnline' },
  { id: 't2', name: 'Bảo hiểm xã hội và Quản lý nhân sự', shortName: 'iBHXH' },
  { id: 't3', name: 'Hóa đơn điện tử, Hải quan và Chuyển đổi số', shortName: 'iXHD' },
];

export const kenh = (n = 0): KenhCounts => Object.fromEntries(KENH.map((k) => [k, n])) as KenhCounts;
const phanLoai = (n = 0): PhanLoaiCounts => Object.fromEntries(PHAN_LOAI.map((p) => [p, n])) as PhanLoaiCounts;

export const row = (over: Partial<TeamKpiRow>): TeamKpiRow => ({
  userId: 'u1',
  fullName: 'Lê Thị An',
  role: 'staff',
  active: true,
  byKenh: kenh(1),
  byPhanLoai: phanLoai(0),
  total: KENH.length,
  money: 12000,
  days: 3,
  ...over,
});

export const teamKpi = (rows: TeamKpiRow[], team: Team = TEAMS[0]!): TeamKpi => ({
  team,
  rows,
  totals: {
    byKenh: kenh(rows.length),
    byPhanLoai: phanLoai(0),
    total: rows.reduce((s, r) => s + r.total, 0),
    money: rows.reduce((s, r) => s + r.money, 0),
    active: rows.filter((r) => r.total > 0).length,
  },
});

const line = (total: number) => ({ total, money: total * 1000, active: 1, people: 2, prevTotal: 10, change: total ? 20 : null });

export const overview = (): DeptOverview => ({
  teams: TEAMS.map((team, i) => ({ team, ...line(12 - i * 4), change: [20, -6, null][i] ?? null })),
  noTeam: { ...line(3), change: null },
  totals: { total: 27, money: 27000, active: 4, people: 8, prevTotal: 99, change: 7 },
  groups: [{ name: 'PI / PO', byTeam: [5, 4, 3], noTeam: 1, total: 13 }],
  prev: { from: '2026-09-16' as never, to: '2026-10-15' as never },
});

export const trend = (unit: 'week' | 'month', totals: number[]): KpiTrend => ({
  unit,
  periods: totals.map((t, i) => ({
    // Tuần: 2026-08-28 là T35, mỗi kỳ cách 7 ngày (tối đa 2 kỳ trong test).
    from: (unit === 'week' ? ['2026-08-28', '2026-09-04'][i] : `2026-${String(5 + i).padStart(2, '0')}-16`) as never,
    to: (unit === 'week' ? ['2026-09-03', '2026-09-10'][i] : `2026-${String(6 + i).padStart(2, '0')}-15`) as never,
    running: i === totals.length - 1,
    total: t,
    money: t * 1000,
    teams: [{ teamId: 't1', total: t, money: t * 1000 }],
  })),
});
