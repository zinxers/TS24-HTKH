import { describe, expect, it } from 'vitest';
import { REPORT_FIELDS, reportFieldsFor } from './report';

describe('REPORT_FIELDS', () => {
  it('key duy nhất trên cả 3 loại', () => {
    const keys = Object.values(REPORT_FIELDS).flatMap((f) => [...f.summary, ...f.team].map((x) => x.key));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('số trường: WR 5/5, MR 14/7, QR 4/9', () => {
    const n = (t: 'WR' | 'MR' | 'QR') => [REPORT_FIELDS[t].summary.length, REPORT_FIELDS[t].team.length];
    expect(n('WR')).toEqual([5, 5]);
    expect(n('MR')).toEqual([14, 7]);
    expect(n('QR')).toEqual([4, 9]);
  });
});

describe('reportFieldsFor', () => {
  it('dept chỉ có phần summary, team thêm phần team', () => {
    expect(reportFieldsFor('WR', 'dept').map((f) => f.key)).toEqual(['sla', 'mttr', 'backlog', 'vanDe', 'ceo']);
    expect(reportFieldsFor('WR', '6f1c1f0e-0000-4000-8000-000000000001').map((f) => f.key)).toEqual([
      'sla', 'mttr', 'backlog', 'vanDe', 'ceo', 'slaTeam', 'mttrTeam', 'repeat', 'vanDeTeam', 'keHoach',
    ]);
  });
});
