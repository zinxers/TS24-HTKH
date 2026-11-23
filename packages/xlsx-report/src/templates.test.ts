import { readFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import { REPORT_FIELDS, type ReportType } from '@ts24-htkh/shared';
import { describe, expect, it } from 'vitest';
import { MR_TREND, QR_PER_PERSON_ROW, REPORT_LAYOUT, WR_ROWS } from './layout';

const TYPES: ReportType[] = ['WR', 'MR', 'QR'];

describe.each(TYPES)('mẫu %s', (type) => {
  const file = new URL(`../../../templates/report-${type}.xlsx`, import.meta.url);
  const sheet = strFromU8(unzipSync(readFileSync(file))['xl/worksheets/sheet1.xml']!);
  const layout = REPORT_LAYOUT[type];

  it('có mọi ô của layout trong sheet1.xml', () => {
    const refs = ['A6', 'B5', layout.signer, layout.total];
    for (const f of Object.values(layout.summary)) refs.push(f.cell);
    for (const f of Object.values(layout.team)) {
      if (f.stacked) for (let i = 0; i < 3; i++) refs.push(`C${f.row + i}`);
      else for (const c of layout.teamCols) refs.push(`${c}${f.row}`);
    }
    if (type === 'WR') for (const row of Object.values(WR_ROWS)) for (const c of layout.teamCols) refs.push(`${c}${row}`);
    if (type === 'QR') for (const c of layout.teamCols) refs.push(`${c}${QR_PER_PERSON_ROW}`);
    if (type === 'MR') refs.push(MR_TREND.total, MR_TREND.arrow, ...MR_TREND.clear);
    const missing = refs.filter((r) => !sheet.includes(`<c r="${r}"`));
    expect(missing).toEqual([]);
  });

  it('key của REPORT_FIELDS và layout khớp nhau', () => {
    const summary = REPORT_FIELDS[type].summary.map((f) => f.key).sort();
    const team = REPORT_FIELDS[type].team.map((f) => f.key).sort();
    expect(Object.keys(layout.summary).sort()).toEqual(summary);
    expect(Object.keys(layout.team).sort()).toEqual(team);
  });
});
