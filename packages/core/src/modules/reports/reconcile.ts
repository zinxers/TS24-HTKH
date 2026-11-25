// Bảng đối soát KPI. Chuyển từ HTKH-KPI/app/src/Pure.js: buildDoiSoat, rateOn (email → userId, TEAMS → teams).
import {
  DEFAULT_KPI_RATES,
  RECONCILE_KENH,
  RECONCILE_TOTAL_KENH,
  reconcileTitle,
  type IsoDate,
  type Kenh,
  type KenhCounts,
  type KpiRange,
  type Reconcile,
  type ReconcileRow,
  type Role,
} from '@ts24-htkh/shared';

export interface ReconcileUser {
  id: string;
  fullName: string;
  role: Role;
  teamId: string | null;
  /** Khóa hoặc xóa mềm. */
  inactive: boolean;
}
export interface ReconcileLine {
  userId: string;
  /** Họ tên snapshot lúc gửi. */
  fullName: string;
  teamId: string | null;
  ticket: string;
  kenh: Kenh;
  createdAt: string;
}
export interface ReconcileTeam {
  id: string;
  name: string;
  sortOrder: number;
}
export interface ReconcileInput {
  teams: ReconcileTeam[];
  users: ReconcileUser[];
  lines: ReconcileLine[];
  rateVersions: { from: IsoDate; rates: Record<string, number> }[];
  range: KpiRange;
}
export type ReconcileTable = Omit<Reconcile, 'flags' | 'fileName'>;

const blank = (): KenhCounts => Object.fromEntries(RECONCILE_KENH.map((k) => [k, 0])) as KenhCounts;

/** Đơn giá từng kênh tại ngày `day`: bản mới nhất có from <= day; thiếu kênh thì lấy mặc định. */
export function ratesOn(versions: ReconcileInput['rateVersions'], day: IsoDate): Record<Kenh, number> {
  let best: ReconcileInput['rateVersions'][number] | null = null;
  for (const v of versions) if (v.from <= day && (!best || v.from > best.from)) best = v;
  return Object.fromEntries(RECONCILE_KENH.map((k) => [k, best?.rates[k] ?? DEFAULT_KPI_RATES[k]])) as Record<Kenh, number>;
}

const byName = (a: ReconcileRow, b: ReconcileRow): number =>
  a.name.localeCompare(b.name, 'vi') || (a.userId < b.userId ? -1 : 1);

export function buildReconcile(input: ReconcileInput): ReconcileTable {
  const { range, users, lines } = input;
  const rate = ratesOn(input.rateVersions, range.to);
  const info = new Map(users.map((u) => [u.id, u]));
  const sorted = [...users].sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi') || (a.id < b.id ? -1 : 1));
  const totals = { counts: blank(), total: 0, money: 0 };

  const blocks = [...input.teams]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((team) => {
      const recs = lines.filter((l) => l.teamId === team.id);
      const has = new Set(recs.map((l) => l.userId));
      const byId = new Map<string, ReconcileRow>();
      const row = (userId: string, name: string, manager: boolean): ReconcileRow => {
        const r = { userId, name, manager, counts: blank(), total: 0, money: 0 };
        byId.set(userId, r);
        return r;
      };
      const rows: ReconcileRow[] = [];
      for (const role of ['manager', 'staff'] as const) {
        for (const u of sorted) {
          if (u.teamId !== team.id || u.role !== role || byId.has(u.id) || (u.inactive && !has.has(u.id))) continue;
          rows.push(row(u.id, u.fullName, role === 'manager'));
        }
      }
      const extra: ReconcileRow[] = [];
      for (const l of recs) {
        const u = info.get(l.userId);
        if (byId.has(l.userId) || (u && u.role !== 'staff')) continue;
        extra.push(row(l.userId, u?.fullName ?? l.fullName, false));
      }
      extra.sort(byName);
      for (const l of recs) {
        const x = byId.get(l.userId);
        if (!x || x.manager) continue;
        const t = RECONCILE_TOTAL_KENH.includes(l.kenh) ? 1 : 0;
        x.counts[l.kenh]++;
        x.total += t;
        x.money += rate[l.kenh];
        totals.counts[l.kenh]++;
        totals.total += t;
        totals.money += rate[l.kenh];
      }
      return { teamId: team.id, label: `TEAM ${team.sortOrder} (${team.name})`, rows: rows.concat(extra) };
    });

  return {
    range,
    title: reconcileTitle(range),
    kenh: RECONCILE_KENH,
    rates: RECONCILE_KENH.map((k) => rate[k]),
    teams: blocks,
    totals,
    rateChanged: input.rateVersions.some((v) => v.from > range.from && v.from <= range.to),
  };
}
