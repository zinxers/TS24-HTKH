import { readFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { isoDate } from '@ts24-htkh/shared';
import { fillReport, reportFileName } from './fill-report';

const template = readFileSync(new URL('../../../templates/report-WR.xlsx', import.meta.url));

describe('fillReport', () => {
  const out = fillReport(template, 'WR', { A6: '😀 a<b', B10: 42, C27: null });
  const before = unzipSync(template);
  const after = unzipSync(out);

  it('mở lại được, sheet1 có giá trị mới, chữ đọc lại đúng', () => {
    const sheet = strFromU8(after['xl/worksheets/sheet1.xml']!);
    expect(sheet).toContain('😀 a&lt;b');
    expect(/<c r="B10"[^>]*><v>42<\/v><\/c>/.test(sheet)).toBe(true);
  });

  it('mọi file khác giữ nguyên byte, cùng thứ tự', () => {
    expect(Object.keys(after)).toEqual(Object.keys(before));
    for (const name of Object.keys(before)) {
      if (name === 'xl/worksheets/sheet1.xml') continue;
      expect(after[name]).toEqual(before[name]);
    }
  });

  it('ô không có trong mẫu thì lỗi', () => {
    expect(() => fillReport(template, 'WR', { Z99: 1 })).toThrow('Không thấy ô Z99 trong file mẫu');
  });
});

describe('reportFileName', () => {
  it('TYPE-TEC-yyMMdd.xlsx', () => {
    expect(reportFileName('MR', isoDate('2026-11-23'))).toBe('MR-TEC-261123.xlsx');
    expect(reportFileName('QR', isoDate('2027-01-09'))).toBe('QR-TEC-270109.xlsx');
  });
});
