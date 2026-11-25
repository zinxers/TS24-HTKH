import type { IsoDate } from './date';
import { parts } from './date';
import type { Kenh } from './kpi';
import type { KenhCounts } from './kpi-team';
import type { KpiRange } from './schemas/kpi';

/** Thứ tự cột đối soát: 4 kênh Nhận thông tin, rồi 7 kênh còn lại. */
export const RECONCILE_KENH: readonly Kenh[] = [
  'PI Nhận thông tin',
  'PO Nhận thông tin',
  'Chat Nhận thông tin',
  'Email Nhận thông tin',
  'PI Hoàn Thành',
  'PO Hoàn Thành',
  'Chat Hoàn Thành',
  'Email Hoàn Thành',
  'Teamviewer Hoàn Thành',
  'Trường hợp khó',
  'Chăm sóc KH',
];
/** Các kênh được cộng vào Tổng (bỏ Nhận thông tin). */
export const RECONCILE_TOTAL_KENH: readonly Kenh[] = RECONCILE_KENH.slice(4);
export const RECONCILE_HIGH: readonly Kenh[] = ['Trường hợp khó', 'Chăm sóc KH'];
export const RECONCILE_MAX_ITEMS = 200;

export interface ReconcileRow {
  userId: string;
  name: string;
  manager: boolean;
  counts: KenhCounts;
  total: number;
  money: number;
}
export interface ReconcileTeamBlock {
  teamId: string;
  label: string;
  rows: ReconcileRow[];
}
export interface ReconcileFlagItem {
  at: string;
  ticket: string;
  kenh: Kenh;
  name: string;
}
export interface ReconcileFlag {
  rule: 1 | 2 | 3 | 4;
  people: { userId: string; name: string; team: string }[];
  text: string;
  count: number;
  money: number;
  items: ReconcileFlagItem[];
  more: number;
}
export interface Reconcile {
  range: KpiRange;
  title: string;
  fileName: string;
  kenh: readonly Kenh[];
  rates: number[];
  teams: ReconcileTeamBlock[];
  totals: { counts: KenhCounts; total: number; money: number };
  rateChanged: boolean;
  flags: ReconcileFlag[];
}

const p2 = (n: number): string => String(n).padStart(2, '0');
const fmt = (d: IsoDate, sep: string): string => {
  const { year, month, day } = parts(d);
  return [p2(day), p2(month), year].join(sep);
};

export function reconcileTitle(range: KpiRange): string {
  const { from, to } = range;
  return from === to
    ? `HTKH - ĐỐI SOÁT KPI ngày ${fmt(from, '/')}`
    : `HTKH - ĐỐI SOÁT KPI từ ${fmt(from, '/')} đến ${fmt(to, '/')}`;
}

export function reconcileFileName(range: KpiRange): string {
  return `HTKH - Đối soát KPI ${fmt(range.from, '.')}-${fmt(range.to, '.')}.xlsx`;
}
