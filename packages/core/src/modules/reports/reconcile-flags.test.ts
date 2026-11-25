// Chuyển từ HTKH-KPI/app/tests/doisoat.test.js (doiSoatFlags), email → userId, TEAMS → teams.
import { isoDate, type Kenh, type Role } from '@ts24-htkh/shared';
import { describe, expect, it } from 'vitest';
import type { ReconcileInput, ReconcileLine, ReconcileUser } from './reconcile';
import { reconcileFlags } from './reconcile-flags';

const range = { from: isoDate('2026-09-16'), to: isoDate('2026-10-15') };
const teams = [
  { id: 't1', name: 'Thuế', sortOrder: 1 },
  { id: 't2', name: 'BHXH', sortOrder: 2 },
];
const user = (id: string, fullName: string, teamId: string | null = 't1', role: Role = 'staff'): ReconcileUser => ({
  id,
  fullName,
  role,
  teamId,
  inactive: false,
});
const line = (userId: string, kenh: Kenh, ticket: string, teamId = 't1', createdAt = '2026-10-05T01:00:00Z'): ReconcileLine => ({
  userId,
  fullName: userId.toUpperCase(),
  teamId,
  ticket,
  kenh,
  createdAt,
});
const many = (n: number, userId: string, kenh: Kenh, teamId = 't1', createdAt?: string): ReconcileLine[] =>
  Array.from({ length: n }, (_, i) => line(userId, kenh, `TICKET/${1000 + i}`, teamId, createdAt));
const run = (users: ReconcileUser[], lines: ReconcileLine[], rule?: 1 | 2 | 3 | 4) =>
  reconcileFlags({ teams, users, lines, rateVersions: [], range } satisfies ReconcileInput).filter((f) => !rule || f.rule === rule);
const U3 = [user('a', 'An'), user('b', 'Bê'), user('c', 'Cê')];
const NT: Kenh = 'PI Nhận thông tin';

describe('reconcileFlags', () => {
  it('QT1 gắn cờ ở 2 lần, không gắn dưới', () => {
    const base = [...many(10, 'b', NT), ...many(10, 'c', NT)];
    const f = run(U3, [...many(5, 'a', 'Trường hợp khó'), ...many(5, 'a', NT), ...base], 1);
    expect(f).toHaveLength(1);
    expect(f[0]!.people).toEqual([{ userId: 'a', name: 'An', team: 'TEAM 1' }]);
    expect(f[0]!.count).toBe(10);
    expect(f[0]!.items).toHaveLength(5);
    expect(f[0]!.money).toBe(5 * 4000);
    expect(f[0]!.text).toBe('50% Trường hợp khó / Chăm sóc KH, team 17% (3,0 lần) · 10 dòng');
    const nine = [...many(5, 'a', 'Trường hợp khó'), ...many(4, 'a', NT), ...base];
    expect(run(U3, nine, 1)).toHaveLength(0);
  });

  it('QT1 đúng 2 lần', () => {
    const recs = [
      ...many(4, 'a', 'Trường hợp khó'), ...many(6, 'a', NT),
      ...many(1, 'b', 'Chăm sóc KH'), ...many(9, 'b', NT),
      ...many(1, 'c', 'Chăm sóc KH'), ...many(9, 'c', NT),
    ];
    expect(run(U3, recs, 1).map((x) => x.people[0]!.userId)).toEqual(['a']);
    expect(run(U3, recs, 1)[0]!.text).toBe('40% Trường hợp khó / Chăm sóc KH, team 20% (2,0 lần) · 10 dòng');
  });

  it('QT1 im khi team không có kênh giá cao', () => {
    expect(run(U3, [...many(12, 'a', NT), ...many(12, 'b', 'PI Hoàn Thành')])).toEqual([]);
  });

  it('QT2 20 dòng một ngày có cờ, 19 không, hai ngày không', () => {
    const u = [user('a', 'An')];
    const d9 = '2026-11-09T01:47:17Z';
    const f = run(u, many(20, 'a', 'Chăm sóc KH', 't1', d9), 2);
    expect(f).toHaveLength(1);
    expect(f[0]!.text).toBe('09/11/2026: 20 dòng Trường hợp khó / Chăm sóc KH');
    expect(f[0]!.money).toBe(20 * 5000);
    expect(run(u, many(19, 'a', 'Chăm sóc KH', 't1', d9), 2)).toHaveLength(0);
    const two = [...many(10, 'a', 'Chăm sóc KH', 't1', '2026-11-08T01:00:00Z'), ...many(10, 'a', 'Chăm sóc KH', 't1', d9)];
    expect(run(u, two, 2)).toHaveLength(0);
  });

  it('QT2 theo ngày giờ VN', () => {
    const u = [user('a', 'An')];
    const split = [...many(10, 'a', 'Chăm sóc KH', 't1', '2026-10-01T16:30:00Z'), ...many(10, 'a', 'Chăm sóc KH', 't1', '2026-10-01T17:30:00Z')];
    expect(run(u, split, 2)).toHaveLength(0);
    const same = [...many(10, 'a', 'Chăm sóc KH', 't1', '2026-10-01T16:30:00Z'), ...many(10, 'a', 'Chăm sóc KH', 't1', '2026-10-01T16:40:00Z')];
    expect(run(u, same, 2)[0]!.text).toBe('01/10/2026: 20 dòng Trường hợp khó / Chăm sóc KH');
  });

  it('QT3 hai kênh Hoàn Thành có cờ; Nhận thông tin + Hoàn Thành không', () => {
    const recs = [
      line('a', 'Email Hoàn Thành', 'TICKET/9'), line('a', 'Teamviewer Hoàn Thành', 'TICKET/9'),
      line('a', NT, 'TICKET/10'), line('a', 'Teamviewer Hoàn Thành', 'TICKET/10'),
    ];
    const f = run(U3, recs, 3);
    expect(f).toHaveLength(1);
    expect(f[0]!.money).toBe(1500 + 2000);
    expect(f[0]!.text).toBe('TICKET/9 ghi từ 2 kênh Hoàn Thành');
  });

  it('QT4 cùng ticket+kênh hai người', () => {
    const f = run(U3, [line('a', 'Email Hoàn Thành', 'TICKET/7'), line('b', 'Email Hoàn Thành', 'TICKET/7')], 4);
    expect(f).toHaveLength(1);
    expect(f[0]!.people.map((p) => p.userId)).toEqual(['a', 'b']);
    expect(f[0]!.money).toBe(3000);
    expect(f[0]!.text).toBe('TICKET/7 · Email Hoàn Thành');
    expect(run(U3, [line('a', 'Email Hoàn Thành', 'TICKET/8'), line('a', 'Email Hoàn Thành', 'TICKET/8')], 4)).toHaveLength(0);
  });

  it('QT4 đếm ticket khác nhau', () => {
    const recs = ['TICKET/1', 'TICKET/2'].flatMap((t) => [line('a', 'Email Hoàn Thành', t), line('b', 'Email Hoàn Thành', t)]);
    const f = run(U3, recs, 4);
    expect(f).toHaveLength(1);
    expect(f[0]!.text).toBe('2 ticket cùng kênh do 2 người tính');
    expect(f[0]!.count).toBe(4);
  });

  it('Quản lý và Trưởng phòng không bị gắn cờ', () => {
    const us = [user('m', 'Quản', 't1', 'manager'), user('h', 'Trưởng', 't1', 'head')];
    expect(run(us, [...many(20, 'm', 'Chăm sóc KH'), ...many(20, 'h', 'Chăm sóc KH')])).toEqual([]);
  });

  it('người ở hai team: QT1 theo từng khối', () => {
    const us = [user('a', 'An', 't1'), user('b', 'Bê', 't1'), user('c', 'Cê', 't2'), user('d', 'Dê', 't2')];
    const recs = [
      ...many(5, 'a', 'Trường hợp khó', 't1'), ...many(5, 'a', NT, 't1'), ...many(10, 'b', NT, 't1'), ...many(10, 'b', NT, 't1'),
      ...many(5, 'a', 'Trường hợp khó', 't2'), ...many(5, 'a', NT, 't2'), ...many(10, 'c', NT, 't2'), ...many(10, 'd', NT, 't2'),
    ];
    const f = run(us, recs, 1);
    expect(f.map((x) => x.people[0]!.team)).toEqual(['TEAM 1', 'TEAM 2']);
    expect(f.every((x) => x.count === 10)).toBe(true);
  });

  it('mục mới nhất trước, tối đa 200, more', () => {
    const u = [user('a', 'An')];
    const lines = Array.from({ length: 205 }, (_, i) =>
      line('a', 'Chăm sóc KH', `TICKET/${i}`, 't1', new Date(Date.UTC(2026, 9, 5, 1, 0, 0) + i * 1000).toISOString()));
    const f = run(u, lines, 2)[0]!;
    expect(f.items).toHaveLength(200);
    expect(f.more).toBe(5);
    expect(f.items[0]!.ticket).toBe('TICKET/204');
    expect(f.items[0]!.at > f.items[1]!.at).toBe(true);
  });

  it('sắp theo rule rồi tiền giảm dần', () => {
    const recs = [
      line('a', 'Email Hoàn Thành', 'TICKET/7'), line('b', 'Email Hoàn Thành', 'TICKET/7'),
      line('a', 'Email Hoàn Thành', 'TICKET/9'), line('a', 'Teamviewer Hoàn Thành', 'TICKET/9'),
      ...many(20, 'c', 'Chăm sóc KH', 't1', '2026-10-06T01:00:00Z'),
    ];
    expect(run(U3, recs).map((f) => f.rule)).toEqual([2, 3, 4]);
    const two = [
      ...many(20, 'a', 'Trường hợp khó', 't1', '2026-10-06T01:00:00Z'),
      ...many(20, 'b', 'Chăm sóc KH', 't1', '2026-10-06T01:00:00Z'),
    ];
    expect(run(U3, two, 2).map((f) => f.people[0]!.userId)).toEqual(['b', 'a']);
  });
});
