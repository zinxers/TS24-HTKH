import type { Role } from './auth';
import type { IsoDate } from './date';
import type { Kenh, MyKpi, PhanLoai } from './kpi';
import type { Team } from './schemas/accounts';

export type KenhCounts = Record<Kenh, number>;
export type PhanLoaiCounts = Record<PhanLoai, number>;

export interface TeamKpiRow {
  userId: string;
  fullName: string;
  /** Vai trò hiện tại khi còn thuộc team; null với người đã rời team. */
  role: Role | null;
  active: boolean;
  byKenh: KenhCounts;
  byPhanLoai: PhanLoaiCounts;
  total: number;
  money: number;
  days: number;
}

export interface TeamKpi {
  team: Team;
  rows: TeamKpiRow[];
  totals: { byKenh: KenhCounts; byPhanLoai: PhanLoaiCounts; total: number; money: number };
}

export interface TeamMemberKpi {
  team: Team;
  userId: string;
  fullName: string;
  money: number;
  items: MyKpi['items'];
}

export interface DeptLine {
  total: number;
  money: number;
  active: number;
  people: number;
  prevTotal: number;
  change: number | null;
}

export interface DeptOverview {
  teams: (DeptLine & { team: Team })[];
  noTeam: DeptLine;
  totals: { total: number; money: number; active: number; people: number };
  groups: { name: string; byTeam: number[]; noTeam: number; total: number }[];
  prev: { from: IsoDate; to: IsoDate };
}

export interface KpiTrend {
  unit: 'week' | 'month';
  periods: {
    from: IsoDate;
    to: IsoDate;
    running: boolean;
    teams: { teamId: string | null; total: number; money: number }[];
  }[];
}
