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
  expectedVersion: number | null;
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

  /** Ghi có điều kiện: expectedVersion null = chỉ tạo mới; số = chỉ sửa khi version khớp. Trả null = xung đột. */
  async upsert(i: ReportNoteInput): Promise<ReportNoteRow | null> {
    const rows =
      i.expectedVersion === null
        ? await this.sql<Raw[]>`
          insert into report_note (report_type, period_start, team_id, fields, updated_by, updated_by_name)
          values (${i.type}, ${i.periodStart}::date, ${i.teamId}::uuid, ${this.sql.json(i.fields as never)},
                  ${i.actorId}::uuid, ${i.actorName})
          on conflict (report_type, period_start, team_id) do nothing
          returning team_id, fields, version, updated_at, updated_by_name`
        : await this.sql<Raw[]>`
          update report_note
            set fields = ${this.sql.json(i.fields as never)}, updated_by = ${i.actorId}::uuid,
                updated_by_name = ${i.actorName}, updated_at = now(), version = version + 1
          where report_type = ${i.type} and period_start = ${i.periodStart}::date
            and team_id is not distinct from ${i.teamId}::uuid and version = ${i.expectedVersion}
          returning team_id, fields, version, updated_at, updated_by_name`;
    return rows[0] ? toRow(rows[0]) : null;
  }
}
