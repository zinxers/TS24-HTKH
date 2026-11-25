import {
  DEPT_SCOPE,
  previousPeriod,
  reportFieldsFor,
  reportPeriods,
  toVnDate,
  type CurrentUser,
  type IsoDate,
  type KpiRange,
  type Period,
  type ReportNoteSaveInput,
  type ReportNotes,
  type ReportPeriod,
  type ReportPreview,
  type ReportScope,
  type ReportType,
  type Team,
} from '@ts24-htkh/shared';
import type { TeamRow } from '@ts24-htkh/db';
import { fillReport, QR_PER_PERSON_ROW, REPORT_LAYOUT, reportFileName, WR_ROWS, type Cells } from '@ts24-htkh/xlsx-report';
import { ConflictError, ValidationError } from '../../errors';
import type { KpiTeamStore, ReportNoteStore, TeamStore, UnitOfWork } from '../../unit-of-work';
import { COLS, QR_LINE_LABEL, reportCells, teamCounts, WR_LINES, type TeamCounts } from './report-cells';
import { ReportPolicy } from './report.policy';
import type { TemplateStore } from './template-store';

export interface ReportServiceDeps {
  teams: TeamStore;
  kpiTeam: KpiTeamStore;
  reportNotes: ReportNoteStore;
  uow: UnitOfWork;
  templates: TemplateStore;
  now?: () => Date;
}

const MSG_NO_TEAM = 'Team không hợp lệ';
const MSG_PERIOD = 'Kỳ báo cáo không hợp lệ';
const MSG_TEXT = 'Nội dung không hợp lệ';
const MSG_CONFLICT = 'Nội dung vừa được người khác sửa, vui lòng tải lại';

const toRange = (p: Period): KpiRange => ({ from: p.start, to: p.end });
const toTeam = (t: TeamRow): Team => ({ id: t.id, name: t.name, shortName: t.short_name });
const sameFields = (a: Record<string, string>, b: Record<string, string>) =>
  Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((k) => a[k] === b[k]);

/** Tính ô, xem trước, xuất file và lưu chữ báo cáo WR/MR/QR. Số theo team_id chụp lúc gửi; dòng không team bỏ qua. */
export class ReportService {
  constructor(private readonly deps: ReportServiceDeps) {}

  async preview(actor: CurrentUser, type: ReportType, start: IsoDate): Promise<ReportPreview> {
    const { period, cells, columns, notes } = await this.compute(actor, type, start);
    const line = (label: string, row: number) => ({
      label,
      values: COLS.map((col) => {
        const v = cells[`${col}${row}`];
        return typeof v === 'number' ? v : null;
      }),
    });
    const rows =
      type === 'WR'
        ? WR_LINES.map((l) => line(l.label, WR_ROWS[l.key]))
        : type === 'QR'
          ? [line(QR_LINE_LABEL, QR_PER_PERSON_ROW)]
          : [];
    const arrow = type === 'MR' ? cells.C23 : null;
    return {
      type,
      period,
      teams: columns.map((t) => (t ? toTeam(t) : null)),
      total: Number(cells[REPORT_LAYOUT[type].total]),
      trend: arrow === '↑' || arrow === '↓' || arrow === '=' ? arrow : null,
      rows,
      notes,
    };
  }

  async file(actor: CurrentUser, type: ReportType, start: IsoDate): Promise<{ fileName: string; bytes: Uint8Array }> {
    const { cells } = await this.compute(actor, type, start);
    const template = await this.deps.templates.load(type);
    return { fileName: reportFileName(type, this.today()), bytes: fillReport(template, type, cells) };
  }

  async notes(actor: CurrentUser, type: ReportType, start: IsoDate): Promise<ReportNotes> {
    const teams = await this.deps.teams.list();
    const scopes = this.viewScopes(actor, teams);
    this.findPeriod(type, start);
    return this.readNotes(type, start, scopes);
  }

  async saveNotes(actor: CurrentUser, type: ReportType, dto: ReportNoteSaveInput): Promise<ReportNotes> {
    ReportPolicy.assertNotStaff(actor, 'report.note.edit');
    const teams = await this.deps.teams.list();
    if (dto.scope !== DEPT_SCOPE && !teams.some((t) => t.id === dto.scope)) throw new ValidationError(MSG_NO_TEAM);
    ReportPolicy.assert(actor, 'report.note.edit', dto.scope);
    this.findPeriod(type, dto.start);
    const allowed = new Set(reportFieldsFor(type, dto.scope).map((f) => f.key));
    if (Object.keys(dto.fields).some((k) => !allowed.has(k))) throw new ValidationError(MSG_TEXT);
    const fields = Object.fromEntries(Object.entries(dto.fields).filter(([, v]) => v.trim() !== ''));
    const teamId = dto.scope === DEPT_SCOPE ? null : dto.scope;

    await this.deps.uow.transaction(async ({ reportNotes, audit }) => {
      const cur = await reportNotes.findForUpdate(type, dto.start, teamId);
      if ((cur?.version ?? null) !== dto.expectedVersion) throw new ConflictError(MSG_CONFLICT);
      const before = cur?.fields ?? {};
      if (sameFields(before, fields)) return;
      const saved = await reportNotes.upsert({
        type,
        periodStart: dto.start,
        teamId,
        fields,
        actorId: actor.id,
        actorName: actor.fullName,
        expectedVersion: dto.expectedVersion,
      });
      if (!saved) throw new ConflictError(MSG_CONFLICT);
      const keys = [...new Set([...Object.keys(before), ...Object.keys(fields)])]
        .filter((k) => before[k] !== fields[k])
        .sort();
      // Không ghi nội dung chữ vào nhật ký.
      await audit.record({
        actorId: actor.id,
        action: 'report.note.save',
        targetId: null,
        detail: { type, periodStart: dto.start, scope: dto.scope, keys },
      });
    });
    return this.readNotes(type, dto.start, this.viewScopes(actor, teams));
  }

  private today(): IsoDate {
    return toVnDate(this.deps.now?.() ?? new Date());
  }

  private findPeriod(type: ReportType, start: IsoDate): ReportPeriod {
    const p = reportPeriods(type, this.today()).find((x) => x.start === start);
    if (!p) throw new ValidationError(MSG_PERIOD);
    return p;
  }

  /** Phạm vi chữ người xem thấy: Cả phòng rồi team theo sort_order (Trưởng phòng); chỉ team mình (Quản lý). */
  private viewScopes(actor: CurrentUser, teams: TeamRow[]): ReportScope[] {
    ReportPolicy.assertNotStaff(actor, 'report.view');
    if (actor.role === 'head') return [DEPT_SCOPE, ...[...teams].sort((a, b) => a.sort_order - b.sort_order).map((t) => t.id)];
    const own = teams.find((t) => t.id === actor.teamId);
    ReportPolicy.assert(actor, 'report.view', own?.id ?? DEPT_SCOPE);
    return [own!.id];
  }

  private async readNotes(type: ReportType, start: IsoDate, scopes: ReportScope[]): Promise<ReportNotes> {
    const rows = await this.deps.reportNotes.list(type, start);
    return {
      scopes: scopes.map((scope) => {
        const r = rows.find((x) => (x.teamId ?? DEPT_SCOPE) === scope);
        return {
          scope,
          fields: r?.fields ?? {},
          version: r?.version ?? null,
          updatedAt: r?.updatedAt ?? null,
          updatedByName: r?.updatedByName ?? null,
        };
      }),
    };
  }

  private async compute(actor: CurrentUser, type: ReportType, start: IsoDate) {
    const teams = await this.deps.teams.list();
    const scopes = this.viewScopes(actor, teams);
    const period = this.findPeriod(type, start);
    // Cột C, D, E = sort_order 1, 2, 3; khác thì là lỗi cấu hình, không xuất file lệch cột.
    const all = [1, 2, 3].map((n) => teams.find((t) => t.sort_order === n));
    if (teams.length !== 3 || all.some((t) => !t)) throw new Error('Cần đúng 3 team để điền báo cáo');
    const columns = all.map((t) => (t && scopes.includes(t.id) ? t : null));

    const count = async (range: KpiRange) =>
      Promise.all(columns.map(async (t) => (t ? teamCounts(await this.deps.kpiTeam.teamCells(t.id, range)) : null)));
    const counts: (TeamCounts | null)[] = await count(toRange(period));
    const prevTotal =
      type === 'MR'
        ? (await count(toRange(previousPeriod(period)))).reduce((s, c) => s + (c?.total ?? 0), 0)
        : 0;
    const notes = await this.readNotes(type, start, scopes);
    const cells: Cells = reportCells(type, counts, {
      label: period.label,
      sentDay: this.today(),
      role: actor.role,
      prevTotal,
      running: period.running,
      notes: Object.fromEntries(notes.scopes.map((s) => [s.scope, s.fields])),
      teamIds: columns.map((t) => t?.id ?? null),
    });
    return { period, cells, columns, notes };
  }
}
