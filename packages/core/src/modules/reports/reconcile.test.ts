// Chuyển từ HTKH-KPI/app/tests/doisoat.test.js (buildDoiSoat), email → userId, TEAMS → teams.
import { DEFAULT_KPI_RATES, RECONCILE_KENH, isoDate, type Kenh, type Role } from '@ts24-htkh/shared';
import { describe, expect, it } from 'vitest';
import {
  buildReconcile,
  ratesOn,
  type ReconcileInput,
  type ReconcileLine,
  type ReconcileUser,
} from './reconcile';

const range = { from: isoDate('2026-09-16'), to: isoDate('2026-10-15') };
const teams = [
  { id: 't2', name: 'Bảo hiểm xã hội và Quản lý nhân sự', sortOrder: 2 },
  { id: 't1', name: 'Thuế, Kế toán và Hệ thống quản lý', sortOrder: 1 },
];
const user = (id: string, fullName: string, teamId: string | null, role: Role = 'staff', inactive = false): ReconcileUser => ({
  id,
  fullName,
  role,
  teamId,
  inactive,
});
const line = (userId: string, kenh: Kenh, teamId: string | null = 't1', fullName = 'Tên Ghi'): ReconcileLine => ({
  userId,
  fullName,
  teamId,
  ticket: 'TICKET/1',
  kenh,
  createdAt: '2026-10-05T07:04:09+07:00',
});
const base = (o: Partial<ReconcileInput>): ReconcileInput => ({
  teams,
  users: [],
  lines: [],
  rateVersions: [],
  range,
  ...o,
});

describe('buildReconcile', () => {
  it('thứ tự dòng: Quản lý trước, Nhân viên theo tên; Trưởng phòng và tài khoản khóa không ticket bị bỏ', () => {
    const users = [
      user('tp', 'TP', null, 'head'),
      user('b', 'Bê', 't1'),
      user('ql', 'Quản', 't1', 'manager'),
      user('a', 'An', 't1'),
      user('k', 'Khóa không ticket', 't1', 'staff', true),
      user('k2', 'Khóa có ticket', 't1', 'staff', true),
      user('c', 'Cê', 't2'),
    ];
    const d = buildReconcile(base({ users, lines: [line('k2', 'Chăm sóc KH'), line('tp', 'Chăm sóc KH')] }));
    expect(d.teams.map((t) => t.teamId)).toEqual(['t1', 't2']);
    expect(d.teams[0]!.rows.map((r) => r.userId)).toEqual(['ql', 'a', 'b', 'k2']);
    expect(d.teams[0]!.rows[0]!.manager).toBe(true);
    expect(d.teams[1]!.rows.map((r) => r.userId)).toEqual(['c']);
    expect(d.totals.total).toBe(1);
  });

  it('11 kênh; Tổng bỏ Nhận thông tin; ticket Quản lý không tính; tiền theo đơn giá ngày cuối', () => {
    const users = [user('ql', 'Quản', 't1', 'manager'), user('a', 'An', 't1')];
    const lines = [
      line('a', 'Chăm sóc KH'),
      line('a', 'Chăm sóc KH'),
      line('a', 'PI Hoàn Thành'),
      line('a', 'Chat Hoàn Thành'),
      line('a', 'PI Nhận thông tin'),
      line('ql', 'Trường hợp khó'),
    ];
    const rateVersions = [
      { from: isoDate('2000-01-01'), rates: { ...DEFAULT_KPI_RATES } },
      { from: isoDate('2026-10-01'), rates: { 'Chăm sóc KH': 6000 } },
    ];
    const d = buildReconcile(base({ users, lines, rateVersions }));
    const a = d.teams[0]!.rows[1]!;
    expect(a.total).toBe(4);
    expect(a.counts['PI Nhận thông tin']).toBe(1);
    expect(a.money).toBe(2 * 6000 + 1000 + 1500 + 600);
    expect(d.teams[0]!.rows[0]).toMatchObject({ total: 0, money: 0 });
    expect(d.totals.total).toBe(4);
    expect(d.totals.money).toBe(a.money);
    expect(d.kenh).toEqual(RECONCILE_KENH);
    expect(d.rates).toEqual(RECONCILE_KENH.map((k) => (k === 'Chăm sóc KH' ? 6000 : DEFAULT_KPI_RATES[k])));
    expect(d.rateChanged).toBe(true);
  });

  it('rateChanged false khi bản đơn giá bắt đầu đúng range.from hoặc sau range.to', () => {
    const users = [user('a', 'An', 't1')];
    const at = (from: string) => buildReconcile(base({ users, rateVersions: [{ from: isoDate(from), rates: {} }] }));
    expect(at('2026-09-16').rateChanged).toBe(false);
    expect(at('2026-10-16').rateChanged).toBe(false);
    expect(at('2026-10-15').rateChanged).toBe(true);
  });

  it('ticket ghi dưới team khác vào team đó, sau người của team, theo tên', () => {
    const users = [user('a', 'An', 't1'), user('z', 'Zed', 't2')];
    const lines = [line('z', 'Chăm sóc KH', 't1', 'Zed'), line('ghost', 'Chăm sóc KH', 't1')];
    const d = buildReconcile(base({ users, lines }));
    expect(d.teams[0]!.rows.map((r) => r.userId)).toEqual(['a', 'ghost', 'z']);
    expect(d.teams[0]!.rows[1]!.name).toBe('Tên Ghi'); // người không có trong users: tên snapshot
    expect(d.teams[1]!.rows[0]!.total).toBe(0);
  });

  it('Quản lý ghi dưới team khác không có dòng ở đó và không vào tổng', () => {
    const users = [user('ql', 'Quản', 't1', 'manager'), user('b', 'Bê', 't2')];
    const d = buildReconcile(base({ users, lines: [line('ql', 'Chăm sóc KH', 't2')] }));
    expect(d.teams[1]!.rows.map((r) => r.userId)).toEqual(['b']);
    expect(d.totals.total).toBe(0);
  });

  it('bỏ dòng có teamId null hoặc không có trong teams', () => {
    const d = buildReconcile(base({ users: [user('a', 'An', 't1')], lines: [line('a', 'PI Hoàn Thành', null), line('a', 'PI Hoàn Thành', 'x')] }));
    expect(d.totals.total).toBe(0);
  });

  it('tiêu đề và nhãn team', () => {
    const d = buildReconcile(base({}));
    expect(d.title).toBe('HTKH - ĐỐI SOÁT KPI từ 16/09/2026 đến 15/10/2026');
    expect(d.teams[0]!.label).toBe('TEAM 1 (Thuế, Kế toán và Hệ thống quản lý)');
  });
});

describe('ratesOn', () => {
  it('thiếu kênh hoặc chưa có bản nào → mặc định', () => {
    expect(ratesOn([], isoDate('2026-10-15'))).toEqual(DEFAULT_KPI_RATES);
    const r = ratesOn([{ from: isoDate('2026-10-01'), rates: { 'Chăm sóc KH': 7000 } }], isoDate('2026-10-15'));
    expect(r['Chăm sóc KH']).toBe(7000);
    expect(r['PI Hoàn Thành']).toBe(1000);
    expect(ratesOn([{ from: isoDate('2026-10-16'), rates: { 'Chăm sóc KH': 7000 } }], isoDate('2026-10-15'))['Chăm sóc KH']).toBe(5000);
  });
});
