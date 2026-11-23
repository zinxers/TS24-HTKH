// Store giả dùng chung cho test ReportService.
import type { AuditEntry, ReportNoteInput, ReportNoteRow, TeamRow } from '@ts24-htkh/db';
import { isoDate, type CurrentUser, type IsoDate, type KpiRange, type ReportType } from '@ts24-htkh/shared';
import type { KpiTeamStore, ReportNoteStore, Repos, TeamStore, UnitOfWork } from '../../unit-of-work';
import { ReportService } from './report.service';
import type { TemplateStore } from './template-store';

export const T1 = '00000000-0000-4000-8000-000000000001';
export const T2 = '00000000-0000-4000-8000-000000000002';
export const T3 = '00000000-0000-4000-8000-000000000003';
export const MISSING = '00000000-0000-4000-8000-0000000000ff';
export const NOW = new Date('2026-11-23T03:00:00.000Z'); // 10:00 giờ Việt Nam
export const WEEK = isoDate('2026-11-20'); // kỳ WR đang chạy
export const OCT = isoDate('2026-10-16'); // kỳ MR 16/10 → 15/11, đã xong

export const actor = (id: string, role: CurrentUser['role'], teamId: string | null): CurrentUser => ({
  id,
  email: `${id}@example.com`,
  fullName: `Tên ${id}`,
  role,
  teamId,
});
export const H = actor('H', 'head', null);
export const M = actor('M', 'manager', T1);
export const S = actor('S', 'staff', T1);

const team = (id: string, name: string, sort: number) =>
  ({ id, name, short_name: `T${sort}`, sort_order: sort }) as TeamRow;

interface Line {
  teamId: string | null;
  userId: string;
  kenh: string;
  phanLoai: string;
  date: string;
}
export const line = (teamId: string | null, userId: string, date: string, kenh = 'PI Hoàn Thành'): Line => ({
  teamId,
  userId,
  kenh,
  phanLoai: 'Hỗ trợ sử dụng',
  date,
});

export class Fake {
  // Không theo sort_order: service phải tự xếp cột.
  teamRows = [team(T3, 'Team 3', 3), team(T1, 'Team 1', 1), team(T2, 'Team 2', 2)];
  lines: Line[] = [
    line(T1, 'a', '2026-11-01'),
    line(T1, 'b', '2026-11-02', 'Chat Hoàn Thành'),
    ...Array.from({ length: 5 }, () => line(T2, 'c', '2026-11-03')),
    line(null, 'd', '2026-11-04'),
    line(T1, 'a', '2026-10-01'),
    ...Array.from({ length: 5 }, () => line(T2, 'c', '2026-10-02')),
    line(T1, 'a', '2026-11-21'),
  ];
  notes = new Map<string, ReportNoteRow & { type: ReportType; periodStart: IsoDate }>();
  audits: AuditEntry[] = [];
  upserts = 0;

  teams = { list: async () => this.teamRows } as TeamStore;

  kpiTeam = {
    teamCells: async (teamId: string | null, r: KpiRange) =>
      this.lines
        .filter((l) => l.teamId === teamId && l.date >= r.from && l.date <= r.to)
        .map((l) => ({ userId: l.userId, kenh: l.kenh, phanLoai: l.phanLoai, count: 1, money: 0 })),
  } as KpiTeamStore;

  private key = (type: string, start: string, teamId: string | null) => `${type}|${start}|${teamId}`;

  reportNotes: ReportNoteStore = {
    list: async (type, start) => [...this.notes.values()].filter((n) => n.type === type && n.periodStart === start),
    findForUpdate: async (type, start, teamId) => this.notes.get(this.key(type, start, teamId)) ?? null,
    upsert: async (i: ReportNoteInput) => {
      this.upserts++;
      const k = this.key(i.type, i.periodStart, i.teamId);
      const cur = this.notes.get(k);
      if ((cur?.version ?? null) !== i.expectedVersion) return null;
      const row = {
        type: i.type,
        periodStart: i.periodStart,
        teamId: i.teamId,
        fields: i.fields,
        version: (cur?.version ?? 0) + 1,
        updatedAt: '2026-11-23T03:00:00.000Z',
        updatedByName: i.actorName,
      };
      this.notes.set(k, row);
      return row;
    },
  };

  uow: UnitOfWork = {
    transaction: (fn) =>
      fn({ reportNotes: this.reportNotes, audit: { record: async (e) => void this.audits.push(e) } } as Repos),
  };

  seed(type: ReportType, start: IsoDate, teamId: string | null, fields: Record<string, string>, version: number) {
    this.notes.set(this.key(type, start, teamId), {
      type,
      periodStart: start,
      teamId,
      fields,
      version,
      updatedAt: '2026-11-22T03:00:00.000Z',
      updatedByName: 'Người cũ',
    });
  }

  service(templates: TemplateStore = { load: async () => new Uint8Array() }) {
    return new ReportService({
      teams: this.teams,
      kpiTeam: this.kpiTeam,
      reportNotes: this.reportNotes,
      uow: this.uow,
      templates,
      now: () => NOW,
    });
  }
}

export const err = async (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e);
