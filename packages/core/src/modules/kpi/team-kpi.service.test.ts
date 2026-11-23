import type { KpiItemRow, TeamRow, UserListRow } from '@ts24-htkh/db';
import { isoDate, KENH, type CurrentUser, type KpiRange } from '@ts24-htkh/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { ForbiddenError, NotFoundError, ValidationError } from '../../errors';
import type { KpiTeamStore, TeamStore, UserStore } from '../../unit-of-work';
import { TeamKpiService } from './team-kpi.service';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const MISSING = '00000000-0000-4000-8000-0000000000ff';
const ANH = 'u-anh';
const BAO = 'u-bao';
const DAT = 'u-dat';
const CUONG = 'u-cuong';
const NOW = new Date('2026-11-19T16:30:00.000Z');
const RANGE: KpiRange = { from: isoDate('2026-10-16'), to: isoDate('2026-11-15') };

const actor = (id: string, role: CurrentUser['role'], teamId: string | null): CurrentUser => ({
  id,
  email: `${id}@example.com`,
  fullName: id,
  role,
  teamId,
});
const H = actor('H', 'head', null);
const M = actor('M', 'manager', A);
const S = actor('S', 'staff', A);

const MSG_TEAM = 'Bạn không có quyền xem báo cáo team';
const MSG_DEPT = 'Chỉ Trưởng phòng được xem tổng quan phòng';

interface Line {
  userId: string;
  fullName: string;
  teamId: string | null;
  kenh: string;
  phanLoai: string;
  amount: number;
  date: string;
  createdAt: string;
}

const line = (userId: string, fullName: string, teamId: string | null, kenh: string, amount: number, date: string): Line => ({
  userId,
  fullName,
  teamId,
  kenh,
  phanLoai: kenh === 'Trường hợp khó' ? 'Lỗi hệ thống, lỗi tích hợp' : 'Hỗ trợ sử dụng',
  amount,
  date,
  createdAt: `${date}T01:00:00.000Z`,
});

const user = (id: string, fullName: string, role: string, teamId: string, status = 'active') =>
  ({ id, full_name: fullName, role, team_id: teamId, status }) as UserListRow;

class Fake {
  users = [
    user(DAT, 'Đạt', 'staff', A, 'locked'),
    user(ANH, 'Ánh', 'manager', A),
    user(BAO, 'Bảo Mới', 'staff', B),
    user(CUONG, 'Cường', 'staff', B),
  ];
  lines: Line[] = [
    line(BAO, 'Bảo cũ', A, 'PI Hoàn Thành', 1000, '2026-11-01'),
    line(BAO, 'Bảo', A, 'Email Hoàn Thành', 1500, '2026-11-02'),
    line(BAO, 'Bảo Mới', B, 'Chat Hoàn Thành', 800, '2026-11-10'),
    line(DAT, 'Đạt', A, 'PI Hoàn Thành', 1000, '2026-11-03'),
    line(DAT, 'Đạt', B, 'Trường hợp khó', 3000, '2026-11-04'),
    line('H', 'Trưởng Phòng H', null, 'Chăm sóc KH', 500, '2026-11-05'),
    line(DAT, 'Đạt', A, 'PI Hoàn Thành', 1000, '2026-10-01'),
  ];

  teams = {
    list: async () =>
      [
        { id: A, name: 'Team A', short_name: 'TA', sort_order: 1 },
        { id: B, name: 'Team B', short_name: 'TB', sort_order: 2 },
      ] as TeamRow[],
  } as TeamStore;

  userStore = {
    listActive: async ({ teamId }: { teamId?: string }) => this.users.filter((u) => u.team_id === teamId),
  } as UserStore;

  private inRange = (r: KpiRange) => this.lines.filter((l) => l.date >= r.from && l.date <= r.to);

  kpiTeam: KpiTeamStore = {
    teamCells: async (teamId, range) => {
      const cells = new Map<string, { userId: string; kenh: string; phanLoai: string; count: number; money: number }>();
      for (const l of this.inRange(range).filter((x) => x.teamId === teamId)) {
        const key = `${l.userId}|${l.kenh}|${l.phanLoai}`;
        const c = cells.get(key) ?? { userId: l.userId, kenh: l.kenh, phanLoai: l.phanLoai, count: 0, money: 0 };
        c.count += 1;
        c.money += l.amount;
        cells.set(key, c);
      }
      return [...cells.values()];
    },
    latestNames: async (teamId, range) => {
      const names = new Map<string, Line>();
      for (const l of this.inRange(range).filter((x) => x.teamId === teamId)) {
        const prev = names.get(l.userId);
        if (!prev || l.createdAt > prev.createdAt) names.set(l.userId, l);
      }
      return [...names.values()].map((l) => ({ userId: l.userId, fullName: l.fullName }));
    },
    daysByUser: async (userIds, range) =>
      userIds.map((userId) => ({
        userId,
        days: new Set(this.inRange(range).filter((l) => l.userId === userId).map((l) => l.date)).size,
      })),
    teamItems: async (teamId, userId, range) =>
      this.inRange(range)
        .filter((l) => l.teamId === teamId && l.userId === userId)
        .sort((x, y) => y.createdAt.localeCompare(x.createdAt))
        .map(
          (l): KpiItemRow => ({
            created_at: l.createdAt,
            ticket: 't',
            kenh: l.kenh,
            phan_loai: l.phanLoai,
            noi_dung: 'n',
            amount: l.amount,
          }),
        ),
    countByTeam: async (range) => {
      const counts = new Map<string | null, number>();
      for (const l of this.inRange(range)) counts.set(l.teamId, (counts.get(l.teamId) ?? 0) + 1);
      return [...counts].map(([teamId, count]) => ({ teamId, count }));
    },
    trend: async (periods, team) =>
      periods.flatMap((p, index) => {
        const byTeam = new Map<string | null, { count: number; money: number }>();
        for (const l of this.inRange(p).filter((x) => team === 'all' || x.teamId === team)) {
          const t = byTeam.get(l.teamId) ?? { count: 0, money: 0 };
          t.count += 1;
          t.money += l.amount;
          byTeam.set(l.teamId, t);
        }
        return [...byTeam].map(([teamId, t]) => ({ index, teamId, ...t }));
      }),
  };
}

let fake: Fake;
let service: TeamKpiService;
beforeEach(() => {
  fake = new Fake();
  service = new TeamKpiService({ teams: fake.teams, users: fake.userStore, kpiTeam: fake.kpiTeam, now: () => NOW });
});

const reject = async (p: Promise<unknown>) => p.then(() => undefined, (e: unknown) => e);

describe('thứ tự kiểm quyền', () => {
  it('Nhân viên với team không tồn tại → ForbiddenError trước ValidationError', async () => {
    const e = await reject(service.report(S, MISSING, RANGE));
    expect(e).toBeInstanceOf(ForbiddenError);
    expect((e as Error).message).toBe(MSG_TEAM);
    await expect(service.report(S, A, RANGE)).rejects.toThrow(ForbiddenError);
    await expect(service.member(S, A, DAT, RANGE)).rejects.toThrow(MSG_TEAM);
    await expect(service.trend(S, MISSING, 'week')).rejects.toThrow(MSG_TEAM);
    await expect(service.overview(S, RANGE)).rejects.toThrow(MSG_DEPT);
  });

  it('Quản lý với team không tồn tại → ValidationError "Team không hợp lệ"', async () => {
    const e = await reject(service.report(M, MISSING, RANGE));
    expect(e).toBeInstanceOf(ValidationError);
    expect((e as Error).message).toBe('Team không hợp lệ');
    await expect(service.member(M, MISSING, DAT, RANGE)).rejects.toThrow(ValidationError);
    await expect(service.trend(M, MISSING, 'week')).rejects.toThrow(ValidationError);
  });

  it('Quản lý xem team khác → ForbiddenError; team mình được', async () => {
    await expect(service.report(M, B, RANGE)).rejects.toThrow(MSG_TEAM);
    await expect(service.member(M, B, BAO, RANGE)).rejects.toThrow(MSG_TEAM);
    await expect(service.trend(M, B, 'week')).rejects.toThrow(MSG_TEAM);
    await expect(service.report(M, A, RANGE)).resolves.toBeDefined();
    await expect(service.trend(M, A, 'month')).resolves.toBeDefined();
  });

  it('Quản lý gọi overview, trend(all) → "Chỉ Trưởng phòng được xem tổng quan phòng"', async () => {
    const e = await reject(service.overview(M, RANGE));
    expect(e).toBeInstanceOf(ForbiddenError);
    expect((e as Error).message).toBe(MSG_DEPT);
    await expect(service.trend(M, 'all', 'week')).rejects.toThrow(MSG_DEPT);
  });
});

describe('report', () => {
  it('bảng team: khóa active=false, rời team role null + tên chụp, chưa có dòng đủ 11 kênh = 0, sắp xếp tiếng Việt', async () => {
    const r = await service.report(H, A, RANGE);
    expect(r.team).toEqual({ id: A, name: 'Team A', shortName: 'TA' });
    expect(r.rows.map((x) => x.fullName)).toEqual(['Ánh', 'Bảo', 'Đạt']);
    const [anh, bao, dat] = r.rows;
    expect(anh).toMatchObject({ userId: ANH, role: 'manager', active: true, total: 0, money: 0, days: 0 });
    expect(Object.keys(anh!.byKenh)).toEqual([...KENH]);
    expect(Object.values(anh!.byKenh).every((n) => n === 0)).toBe(true);
    expect(bao).toMatchObject({ userId: BAO, role: null, active: false, total: 2, money: 2500, days: 3 });
    expect(bao!.byKenh['PI Hoàn Thành']).toBe(1);
    expect(bao!.byPhanLoai['Hỗ trợ sử dụng']).toBe(2);
    expect(dat).toMatchObject({ userId: DAT, role: 'staff', active: false, total: 1, money: 1000, days: 2 });
    expect(r.totals).toMatchObject({ total: 3, money: 3500 });
    expect(r.totals.byKenh['PI Hoàn Thành']).toBe(2);
    expect(r.totals.byKenh['Email Hoàn Thành']).toBe(1);
  });

  it('team rỗng → rows [], totals 0', async () => {
    fake.users = [];
    fake.lines = [];
    const r = await service.report(H, A, RANGE);
    expect(r.rows).toEqual([]);
    expect(r.totals.total).toBe(0);
    expect(r.totals.money).toBe(0);
    expect(Object.values(r.totals.byKenh).every((n) => n === 0)).toBe(true);
  });
});

describe('member', () => {
  it('Trưởng phòng xem người đã rời team: tên chụp, chỉ dòng của team, mới nhất trước', async () => {
    const m = await service.member(H, A, BAO, RANGE);
    expect(m).toMatchObject({ userId: BAO, fullName: 'Bảo', money: 2500 });
    expect(m.team.id).toBe(A);
    expect(m.items.map((i) => i.kenh)).toEqual(['Email Hoàn Thành', 'PI Hoàn Thành']);
  });

  it('Quản lý hỏi người team khác và id ngẫu nhiên → cùng NotFoundError', async () => {
    const other = await reject(service.member(M, A, CUONG, RANGE));
    const random = await reject(service.member(M, A, 'khong-ton-tai', RANGE));
    for (const e of [other, random]) {
      expect(e).toBeInstanceOf(NotFoundError);
      expect((e as Error).message).toBe('Không tìm thấy thành viên');
    }
  });
});

describe('overview', () => {
  it('change null khi prevTotal 0; totals cộng cả noTeam; active ≤ people', async () => {
    const o = await service.overview(H, RANGE);
    expect(o.teams.map((t) => t.team.id)).toEqual([A, B]);
    expect(o.teams[0]).toMatchObject({ total: 3, money: 3500, active: 2, people: 3, prevTotal: 1, change: 200 });
    expect(o.teams[1]).toMatchObject({ total: 2, money: 3800, active: 2, people: 3, prevTotal: 0, change: null });
    expect(o.noTeam).toEqual({ total: 1, money: 500, active: 1, people: 1, prevTotal: 0, change: null });
    // Cả phòng: prevTotal cộng mọi team kể cả null (1), change = (6-1)/1 = 500%.
    expect(o.totals).toEqual({ total: 6, money: 7800, active: 5, people: 7, prevTotal: 1, change: 500 });
    expect(o.totals.active).toBeLessThanOrEqual(o.totals.people);
    expect(o.groups.find((g) => g.name === 'PI / PO')).toEqual({ name: 'PI / PO', byTeam: [2, 0], noTeam: 0, total: 2 });
    expect(o.groups.find((g) => g.name === 'Chăm sóc KH')).toEqual({ name: 'Chăm sóc KH', byTeam: [0, 0], noTeam: 1, total: 1 });
  });

  it('kỳ so sánh: tháng TS24 về tháng trước, khoảng khác lùi cùng số ngày', async () => {
    expect((await service.overview(H, RANGE)).prev).toEqual({ from: '2026-09-16', to: '2026-10-15' });
    const week = { from: isoDate('2026-11-01'), to: isoDate('2026-11-07') };
    expect((await service.overview(H, week)).prev).toEqual({ from: '2026-10-25', to: '2026-10-31' });
  });
});

describe('trend', () => {
  it('week: 12 kỳ, kỳ cuối 2026-11-13..2026-11-19 running, đủ team + Không thuộc team', async () => {
    const t = await service.trend(H, 'all', 'week');
    expect(t.unit).toBe('week');
    expect(t.periods).toHaveLength(12);
    expect(t.periods.at(-1)).toMatchObject({ from: '2026-11-13', to: '2026-11-19', running: true });
    expect(t.periods.slice(0, -1).every((p) => !p.running)).toBe(true);
    for (const p of t.periods) expect(p.teams.map((x) => x.teamId)).toEqual([A, B, null]);
    const w = t.periods.find((p) => p.from === '2026-10-30')!;
    expect(w.teams).toEqual([
      { teamId: A, total: 3, money: 3500 },
      { teamId: B, total: 1, money: 3000 },
      { teamId: null, total: 1, money: 500 },
    ]);
  });

  it('một team: chỉ team đó, kỳ không có dòng = 0', async () => {
    const t = await service.trend(H, B, 'month');
    expect(t.periods).toHaveLength(6);
    for (const p of t.periods) expect(p.teams.map((x) => x.teamId)).toEqual([B]);
    expect(t.periods[0]!.teams[0]).toEqual({ teamId: B, total: 0, money: 0 });
  });
});
