import type { CurrentUser } from '@ts24-htkh/shared';
import { describe, expect, it } from 'vitest';
import { can, canKpi, canSee, canTeamKpi, type AccountAction } from './permissions';

const A = 'team-a';
const B = 'team-b';
const user = (id: string, role: CurrentUser['role'], teamId: string | null): CurrentUser => ({
  id,
  email: `${id}@example.com`,
  fullName: id,
  role,
  teamId,
});

const H = user('H', 'head', null);
const M = user('M', 'manager', A);
const M2 = user('M2', 'manager', B);
const S = user('S', 'staff', A);
const SA = user('SA', 'staff', A);
const SB = user('SB', 'staff', B);
const actors = { H, M, M2, S };
const targets = { H, M, M2, S, SA, SB };

/** Đích mỗi người làm được tác động bằng lock/unlock/delete/set_password (theo bảng Quyền). */
const manageable: Record<keyof typeof actors, string[]> = {
  H: ['M', 'M2', 'S', 'SA', 'SB'],
  M: ['S', 'SA'],
  M2: ['SB'],
  S: [],
};
/** account.update chỉ đổi họ tên: Trưởng phòng sửa được cả chính mình. */
const updatable: Record<keyof typeof actors, string[]> = { ...manageable, H: ['H', ...manageable.H] };

const cases: [AccountAction, string, string, boolean][] = [];
for (const action of ['account.lock', 'account.unlock', 'account.delete', 'account.set_password'] as const) {
  for (const a of Object.keys(actors) as (keyof typeof actors)[]) {
    for (const t of Object.keys(targets)) cases.push([action, a, t, manageable[a].includes(t)]);
  }
}
for (const a of Object.keys(actors) as (keyof typeof actors)[]) {
  for (const t of Object.keys(targets)) cases.push(['account.update', a, t, updatable[a].includes(t)]);
}

describe('can: hành động trên một đích', () => {
  it.each(cases)('%s: %s → %s = %s', (action, a, t, expected) => {
    const actor = actors[a as keyof typeof actors];
    expect(can(actor, action, targets[t as keyof typeof targets])).toBe(expected);
  });
});

describe('can: không cần đích', () => {
  it.each([
    ['account.list', { H: true, M: true, M2: true, S: false }],
    ['account.transfer_head', { H: true, M: false, M2: false, S: false }],
    ['profile.update', { H: true, M: true, M2: true, S: true }],
  ] as const)('%s', (action, expected) => {
    for (const [a, ok] of Object.entries(expected)) {
      expect(can(actors[a as keyof typeof actors], action)).toBe(ok);
    }
  });
});

describe('can: tạo tài khoản', () => {
  it.each([
    [H, 'staff', A, true],
    [H, 'manager', B, true],
    [H, 'head', null, false],
    [M, 'staff', A, true],
    [M, 'staff', B, false],
    [M, 'manager', A, false],
    [M2, 'staff', B, true],
    [S, 'staff', A, false],
  ] as const)('%#: tạo %s team %s → %s', (actor, role, teamId, expected) => {
    expect(can(actor, 'account.create', undefined, { role, teamId })).toBe(expected);
  });
});

describe('can: đổi vai trò, team', () => {
  it('Quản lý không nâng staff thành manager, không chuyển team', () => {
    expect(can(M, 'account.update', SA, { role: 'manager' })).toBe(false);
    expect(can(M, 'account.update', SA, { teamId: B })).toBe(false);
    expect(can(M, 'account.update', SA, { role: 'staff', teamId: A })).toBe(true);
  });

  it('Trưởng phòng sửa chính mình chỉ được họ tên', () => {
    expect(can(H, 'account.update', H, { role: 'manager' })).toBe(false);
    expect(can(H, 'account.update', H, { teamId: A })).toBe(false);
    expect(can(H, 'account.update', H, {})).toBe(true);
  });

  it('Trưởng phòng đổi vai trò, team người khác nhưng không gán head', () => {
    expect(can(H, 'account.update', SA, { role: 'manager', teamId: B })).toBe(true);
    expect(can(H, 'account.update', SA, { role: 'head' })).toBe(false);
  });

  it('không ai khóa hay xóa Trưởng phòng', () => {
    for (const actor of Object.values(actors)) {
      expect(can(actor, 'account.lock', H)).toBe(false);
      expect(can(actor, 'account.delete', H)).toBe(false);
    }
  });

  it('hành động cần đích mà thiếu đích → false', () => {
    expect(can(H, 'account.lock')).toBe(false);
  });
});

describe('canSee: phạm vi xem', () => {
  it.each([
    [H, [H, M, M2, S, SA, SB], []],
    [M, [M, S, SA], [H, M2, SB]],
    [M2, [M2, SB], [H, M, S, SA]],
    [S, [S], [H, M, M2, SA, SB]],
  ])('%#', (actor, visible, hidden) => {
    for (const t of visible) expect(canSee(actor, t)).toBe(true);
    for (const t of hidden) expect(canSee(actor, t)).toBe(false);
  });
});

describe('canKpi', () => {
  it('kpi.submit: mọi vai trò được gửi', () => {
    for (const a of [H, M, S]) expect(canKpi(a, 'kpi.submit')).toBe(true);
  });

  it('rate.set: chỉ Trưởng phòng', () => {
    expect(canKpi(H, 'rate.set')).toBe(true);
    expect(canKpi(M, 'rate.set')).toBe(false);
    expect(canKpi(S, 'rate.set')).toBe(false);
  });
});

describe('canTeamKpi', () => {
  it('team.kpi.view: Trưởng phòng mọi team, Quản lý chỉ team mình', () => {
    expect(canTeamKpi(H, 'team.kpi.view', A)).toBe(true);
    expect(canTeamKpi(H, 'team.kpi.view', B)).toBe(true);
    expect(canTeamKpi(M, 'team.kpi.view', A)).toBe(true);
    expect(canTeamKpi(M, 'team.kpi.view', B)).toBe(false);
    expect(canTeamKpi(M, 'team.kpi.view')).toBe(false);
  });

  it('team.kpi.view: Quản lý không có team, Nhân viên bị chặn', () => {
    expect(canTeamKpi(user('M0', 'manager', null), 'team.kpi.view', A)).toBe(false);
    expect(canTeamKpi(S, 'team.kpi.view', A)).toBe(false);
  });

  it('dept.kpi.view: chỉ Trưởng phòng', () => {
    expect(canTeamKpi(H, 'dept.kpi.view')).toBe(true);
    expect(canTeamKpi(M, 'dept.kpi.view')).toBe(false);
    expect(canTeamKpi(S, 'dept.kpi.view')).toBe(false);
  });
});
