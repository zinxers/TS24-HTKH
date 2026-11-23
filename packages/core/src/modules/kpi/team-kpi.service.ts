import {
  KENH,
  KENH_GROUPS,
  PHAN_LOAI,
  previousPeriod,
  toVnDate,
  trendPeriods,
  type CurrentUser,
  type DeptLine,
  type DeptOverview,
  type Kenh,
  type KenhCounts,
  type KpiRange,
  type KpiTrend,
  type PhanLoai,
  type PhanLoaiCounts,
  type Role,
  type Period,
  type Team,
  type TeamKpi,
  type TeamKpiRow,
  type TeamMemberKpi,
} from '@ts24-htkh/shared';
import { NotFoundError, ValidationError } from '../../errors';
import type { TeamKpiAction } from '../../policies/permissions';
import type { KpiTeamStore, TeamStore, UserStore } from '../../unit-of-work';
import { TeamKpiPolicy } from './team-kpi.policy';

export interface TeamKpiServiceDeps {
  teams: TeamStore;
  users: UserStore;
  kpiTeam: KpiTeamStore;
  now?: () => Date;
}

const MSG_NO_TEAM = 'Team không hợp lệ';
const MSG_NO_MEMBER = 'Không tìm thấy thành viên';

const zeroKenh = () => Object.fromEntries(KENH.map((k) => [k, 0])) as KenhCounts;
const zeroPhanLoai = () => Object.fromEntries(PHAN_LOAI.map((p) => [p, 0])) as PhanLoaiCounts;
const toRange = (p: Period): KpiRange => ({ from: p.start, to: p.end });
const change = (total: number, prevTotal: number) =>
  prevTotal ? Math.round(((total - prevTotal) * 100) / prevTotal) : null;

/** Chỉ đọc. Dòng tính cho team theo team_id chụp lúc gửi; `null` = "Không thuộc team". */
export class TeamKpiService {
  constructor(private readonly deps: TeamKpiServiceDeps) {}

  async report(actor: CurrentUser, teamId: string, range: KpiRange): Promise<TeamKpi> {
    const team = await this.findTeam(actor, 'team.kpi.view', teamId);
    const { rows, totals } = await this.table(team.id, range);
    return { team, rows, totals };
  }

  /** Ngoài tập người của bảng team kỳ đó (kể cả id không có) trả cùng một 404, không lộ tên. */
  async member(actor: CurrentUser, teamId: string, userId: string, range: KpiRange): Promise<TeamMemberKpi> {
    const team = await this.findTeam(actor, 'team.kpi.view', teamId);
    const [current, names] = await Promise.all([
      this.deps.users.listActive({ teamId: team.id }),
      this.deps.kpiTeam.latestNames(team.id, range),
    ]);
    const fullName =
      current.find((u) => u.id === userId)?.full_name ?? names.find((n) => n.userId === userId)?.fullName;
    if (fullName === undefined) throw new NotFoundError(MSG_NO_MEMBER);
    const items = (await this.deps.kpiTeam.teamItems(team.id, userId, range)).map((i) => ({
      createdAt: i.created_at,
      ticket: i.ticket,
      kenh: i.kenh as Kenh,
      phanLoai: i.phan_loai as PhanLoai,
      noiDung: i.noi_dung,
      amount: i.amount,
    }));
    return { team, userId, fullName, money: items.reduce((n, i) => n + i.amount, 0), items };
  }

  async overview(actor: CurrentUser, range: KpiRange): Promise<DeptOverview> {
    TeamKpiPolicy.assertNotStaff(actor, 'dept.kpi.view');
    TeamKpiPolicy.assert(actor, 'dept.kpi.view');
    const prev = toRange(previousPeriod({ start: range.from, end: range.to }));
    const teams = await this.listTeams();
    const [tables, noTeamCells, prevCounts] = await Promise.all([
      Promise.all(teams.map((t) => this.table(t.id, range))),
      this.deps.kpiTeam.teamCells(null, range),
      this.deps.kpiTeam.countByTeam(prev),
    ]);
    const prevOf = (teamId: string | null) => prevCounts.find((c) => c.teamId === teamId)?.count ?? 0;
    const lineOf = (teamId: string | null, total: number, money: number, active: number, people: number): DeptLine => {
      const prevTotal = prevOf(teamId);
      return { total, money, active, people, prevTotal, change: change(total, prevTotal) };
    };

    const teamLines = teams.map((team, i) => {
      const { rows, totals } = tables[i]!;
      return { team, ...lineOf(team.id, totals.total, totals.money, totals.active, rows.length) };
    });
    const noTeamKenh = zeroKenh();
    for (const c of noTeamCells) noTeamKenh[c.kenh as Kenh] += c.count;
    const noTeamPeople = new Set(noTeamCells.map((c) => c.userId)).size;
    const noTeam = lineOf(
      null,
      noTeamCells.reduce((n, c) => n + c.count, 0),
      noTeamCells.reduce((n, c) => n + c.money, 0),
      noTeamPeople,
      noTeamPeople,
    );

    const all = [...teamLines, noTeam];
    const deptPrev = prevCounts.reduce((n, c) => n + c.count, 0);
    const sum = (k: 'total' | 'money') => all.reduce((n, l) => n + l[k], 0);
    // Cả phòng đếm người khác nhau: người chuyển team giữa kỳ chỉ tính một lần.
    const rowsAll = tables.flatMap((t) => t.rows);
    // teamCells đến từ group by nên mọi ô đều có count > 0: người có ô không team là người có BC.
    const people = new Set([...rowsAll.map((r) => r.userId), ...noTeamCells.map((c) => c.userId)]).size;
    const active = new Set([
      ...rowsAll.filter((r) => r.total > 0).map((r) => r.userId),
      ...noTeamCells.map((c) => c.userId),
    ]).size;
    const groups = KENH_GROUPS.map((g) => {
      const count = (byKenh: KenhCounts) => g.kenh.reduce((n, k) => n + byKenh[k], 0);
      const byTeam = tables.map((t) => count(t.totals.byKenh));
      const noTeamCount = count(noTeamKenh);
      return { name: g.name, byTeam, noTeam: noTeamCount, total: byTeam.reduce((n, x) => n + x, noTeamCount) };
    });
    return {
      teams: teamLines,
      noTeam,
      totals: {
        total: sum('total'),
        money: sum('money'),
        active,
        people,
        prevTotal: deptPrev,
        change: change(sum('total'), deptPrev),
      },
      groups,
      prev,
    };
  }

  async trend(actor: CurrentUser, team: string | 'all', unit: 'week' | 'month'): Promise<KpiTrend> {
    let teamIds: (string | null)[];
    if (team === 'all') {
      TeamKpiPolicy.assertNotStaff(actor, 'dept.kpi.view');
      TeamKpiPolicy.assert(actor, 'dept.kpi.view');
      teamIds = [...(await this.listTeams()).map((t) => t.id), null];
    } else {
      teamIds = [(await this.findTeam(actor, 'team.kpi.view', team)).id];
    }
    const today = toVnDate(this.deps.now?.() ?? new Date());
    const periods = trendPeriods(unit, today).map(toRange);
    const cells = await this.deps.kpiTeam.trend(periods, team);
    return {
      unit,
      periods: periods.map((p, index) => {
        const teams = teamIds.map((teamId) => {
          const c = cells.find((x) => x.index === index && x.teamId === teamId);
          return { teamId, total: c?.count ?? 0, money: c?.money ?? 0 };
        });
        return {
          ...p,
          running: p.from <= today && today <= p.to,
          total: teams.reduce((n, t) => n + t.total, 0),
          money: teams.reduce((n, t) => n + t.money, 0),
          teams,
        };
      }),
    };
  }

  private async listTeams(): Promise<Team[]> {
    return (await this.deps.teams.list()).map((t) => ({ id: t.id, name: t.name, shortName: t.short_name }));
  }

  /** Thứ tự kiểm: Nhân viên 403 → team không có 400 → ngoài phạm vi 403. */
  private async findTeam(actor: CurrentUser, action: TeamKpiAction, teamId: string): Promise<Team> {
    TeamKpiPolicy.assertNotStaff(actor, action);
    const team = (await this.listTeams()).find((t) => t.id === teamId);
    if (!team) throw new ValidationError(MSG_NO_TEAM);
    TeamKpiPolicy.assert(actor, action, teamId);
    return team;
  }

  /** Người trong bảng = tài khoản đang thuộc team ∪ người có dòng của team trong kỳ. */
  private async table(teamId: string, range: KpiRange): Promise<Omit<TeamKpi, 'team'>> {
    const k = this.deps.kpiTeam;
    const [current, cells, names] = await Promise.all([
      this.deps.users.listActive({ teamId }),
      k.teamCells(teamId, range),
      k.latestNames(teamId, range),
    ]);
    const ids = [...new Set([...current.map((u) => u.id), ...cells.map((c) => c.userId)])];
    const days = await k.daysByUser(ids, range);
    const totals = { byKenh: zeroKenh(), byPhanLoai: zeroPhanLoai(), total: 0, money: 0, active: 0 };
    const rows = ids.map((userId): TeamKpiRow => {
      const u = current.find((x) => x.id === userId);
      const row: TeamKpiRow = {
        userId,
        fullName: u?.full_name ?? names.find((n) => n.userId === userId)?.fullName ?? '',
        role: (u?.role as Role | undefined) ?? null,
        // `u` chỉ có khi người đó còn thuộc team; đã rời team hoặc bị khóa đều tính là không hoạt động.
        active: u?.status === 'active',
        byKenh: zeroKenh(),
        byPhanLoai: zeroPhanLoai(),
        total: 0,
        money: 0,
        days: days.find((d) => d.userId === userId)?.days ?? 0,
      };
      for (const c of cells.filter((x) => x.userId === userId)) {
        row.byKenh[c.kenh as Kenh] += c.count;
        row.byPhanLoai[c.phanLoai as PhanLoai] += c.count;
        row.total += c.count;
        row.money += c.money;
      }
      return row;
    });
    for (const r of rows) {
      for (const kenh of KENH) totals.byKenh[kenh] += r.byKenh[kenh];
      for (const p of PHAN_LOAI) totals.byPhanLoai[p] += r.byPhanLoai[p];
      totals.total += r.total;
      totals.money += r.money;
      if (r.total > 0) totals.active += 1;
    }
    rows.sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi') || a.userId.localeCompare(b.userId));
    return { rows, totals };
  }
}
