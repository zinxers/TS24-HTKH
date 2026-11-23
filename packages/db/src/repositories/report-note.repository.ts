import type { IsoDate, ReportType } from '@ts24-htkh/shared';
import type { Sql } from '../client';

export interface ReportNoteRow {
  teamId: string | null;
  fields: Record<string, string>;
  version: number;
  updatedAt: string;
  updatedByName: string;
}

export interface ReportNoteInput {
  type: ReportType;
  periodStart: IsoDate;
  teamId: string | null;
  fields: Record<string, string>;
  actorId: string;
  actorName: string;
}

type Raw = {
  team_id: string | null;
  fields: Record<string, string>;
  version: number;
  updated_at: string;
  updated_by_name: string;
};

const toRow = (r: Raw): ReportNoteRow => ({
  teamId: r.team_id,
  fields: r.fields,
  version: r.version,
  updatedAt: r.updated_at,
  updatedByName: r.updated_by_name,
});

/** Chỉ đọc/ghi report_note. Luật quyền và so khớp version nằm ở Service. */
export class ReportNoteRepository {
  constructor(private readonly sql: Sql) {}

  async list(type: ReportType, periodStart: IsoDate): Promise<ReportNoteRow[]> {
    const rows = await this.sql<Raw[]>`
      select team_id, fields, version, updated_at, updated_by_name
      from report_note where report_type = ${type} and period_start = ${periodStart}::date`;
    return rows.map(toRow);
  }

  async findForUpdate(type: ReportType, periodStart: IsoDate, teamId: string | null): Promise<ReportNoteRow | null> {
    const rows = await this.sql<Raw[]>`
      select team_id, fields, version, updated_at, updated_by_name
      from report_note
      where report_type = ${type} and period_start = ${periodStart}::date
        and team_id is not distinct from ${teamId}::uuid
      for update`;
    return rows[0] ? toRow(rows[0]) : null;
  }

  async upsert(i: ReportNoteInput): Promise<ReportNoteRow> {
    const rows = await this.sql<Raw[]>`
      insert into report_note (report_type, period_start, team_id, fields, updated_by, updated_by_name)
      values (${i.type}, ${i.periodStart}::date, ${i.teamId}::uuid, ${this.sql.json(i.fields as never)},
              ${i.actorId}::uuid, ${i.actorName})
      on conflict (report_type, period_start, team_id) do update
        set fields = excluded.fields, updated_by = excluded.updated_by,
            updated_by_name = excluded.updated_by_name, updated_at = now(),
            version = report_note.version + 1
      returning team_id, fields, version, updated_at, updated_by_name`;
    return toRow(rows[0]!);
  }
}
