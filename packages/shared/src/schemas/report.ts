import { z } from 'zod';
import type { ReportPeriod, ReportType } from '../period';
import { DEPT_SCOPE, MAX_NOTE_TEXT, type ReportScope } from '../report';
import type { Team } from './accounts';
import { isoDateField } from './kpi';

const MSG = {
  type: 'Loại báo cáo không hợp lệ',
  text: 'Nội dung không hợp lệ',
  textMax: 'Mỗi ô tối đa 2.000 ký tự',
};

export const reportTypeSchema = z.enum(['WR', 'MR', 'QR'], { error: MSG.type });

export const reportQuerySchema = z.object({ start: isoDateField });

const noteText = z
  .string({ error: MSG.text })
  .transform((s) => s.normalize('NFC').replace(/\r\n/g, '\n').trim())
  .pipe(z.string().max(MAX_NOTE_TEXT, MSG.textMax));

/** Key hợp lệ theo `type` + `scope` do core kiểm. */
export const reportNoteSaveSchema = z.object({
  start: isoDateField,
  scope: z.union([z.literal(DEPT_SCOPE), z.uuid()]),
  fields: z.record(z.string(), noteText),
  expectedVersion: z.number().int().min(1).nullable(),
});
export type ReportNoteSaveInput = z.infer<typeof reportNoteSaveSchema>;

export interface ReportNoteScope {
  scope: ReportScope;
  fields: Record<string, string>;
  version: number | null;
  updatedAt: string | null;
  updatedByName: string | null;
}
export interface ReportNotes {
  scopes: ReportNoteScope[];
}

/** `teams` và `values` dài 3; `trend` chỉ khác null ở MR. */
export interface ReportPreview {
  type: ReportType;
  period: ReportPeriod;
  teams: (Team | null)[];
  total: number;
  trend: '↑' | '↓' | '=' | null;
  rows: { label: string; values: (number | null)[] }[];
  notes: ReportNotes;
}
