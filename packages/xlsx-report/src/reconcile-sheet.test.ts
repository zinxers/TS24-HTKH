import { readFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import { RECONCILE_KENH, type Kenh, type KenhCounts } from '@ts24-htkh/shared';
import { describe, expect, it } from 'vitest';
import { fillReconcile, reconcileSheetXml, type ReconcileSheetData } from './reconcile-sheet';

const template = readFileSync(new URL('../../../templates/doi-soat.xlsx', import.meta.url));
const files = unzipSync(template);
const sheet1 = strFromU8(files['xl/worksheets/sheet1.xml']!);
const cellOf = (xml: string, ref: string): string =>
  new RegExp(`<c r="${ref}"[^>]*?(?:/>|>[^]*?</c>)`).exec(xml)?.[0] ?? '';

const counts = (o: Partial<Record<Kenh, number>> = {}): KenhCounts =>
  Object.fromEntries(RECONCILE_KENH.map((k) => [k, o[k] ?? 0])) as KenhCounts;
const rates = RECONCILE_KENH.map((k) => (k === 'Chăm sóc KH' ? 5000 : k === 'PI Nhận thông tin' ? 600 : 0));
const person = (name: string, c: KenhCounts, total: number, money: number, manager = false) => ({
  userId: name,
  name,
  manager,
  counts: c,
  total,
  money,
});

const data: ReconcileSheetData = {
  title: 'TIÊU ĐỀ',
  kenh: RECONCILE_KENH,
  rates,
  teams: [
    {
      teamId: 't1',
      label: 'TEAM 1 (Thuế)',
      rows: [
        person('Quản & Co', counts(), 0, 0, true),
        person('An', counts({ 'Chăm sóc KH': 1, 'PI Nhận thông tin': 1 }), 1, 5600),
        person('Bê', counts(), 0, 0),
      ],
    },
    { teamId: 't2', label: 'TEAM 2 (BHXH)', rows: [] },
    { teamId: 't3', label: 'TEAM 3 (Khác)', rows: [person('Cê', counts({ 'PO Hoàn Thành': 1 }), 1, 0)] },
  ],
  totals: { counts: counts({ 'Chăm sóc KH': 1, 'PI Nhận thông tin': 1, 'PO Hoàn Thành': 1 }), total: 2, money: 5600 },
};

describe('mẫu doi-soat.xlsx', () => {
  it('mẫu: đủ sheet và logo, không calcChain, không còn tên người trong sharedStrings', () => {
    const names = Object.keys(files);
    expect(names).toContain('xl/worksheets/sheet2.xml');
    expect(names).toContain('xl/drawings/drawing1.xml');
    expect(names).not.toContain('xl/calcChain.xml');
    expect(strFromU8(files['[Content_Types].xml']!)).not.toContain('calcChain');
    const ss = strFromU8(files['xl/sharedStrings.xml']!);
    expect(ss.match(/<si><t[^>]*>[^<]+<\/t><\/si>/g)).toHaveLength(16);
    expect(ss).toContain('CASE NHẬN');
    expect(sheet1).toMatch(/ySplit="7" topLeftCell="B8"/);
  });
});

describe('reconcileSheetXml', () => {
  const xml = reconcileSheetXml(sheet1, data);

  it('sheet: 18 cột, công thức kèm giá trị, gộp ô khối team, không có dòng TICKET NV', () => {
    expect(cellOf(xml, 'B1')).toContain('TIÊU ĐỀ');
    expect(cellOf(xml, 'R1')).toContain('HTKH-ĐS-KPI');
    expect(cellOf(xml, 'R2')).toBe('<c r="R2" s="17"><v>1</v></c>');
    expect(xml).not.toContain('TICKET NV');
    expect(cellOf(xml, 'B6')).toContain('Tổng các hình thức xử lý');
    expect(cellOf(xml, 'C6')).toContain('PI Nhận thông tin');
    expect(cellOf(xml, 'M6')).toContain('Chăm sóc KH');
    expect(cellOf(xml, 'N6')).toContain('KPI');
    expect(cellOf(xml, 'R6')).toContain('Ghi chú');
    expect(cellOf(xml, 'M7')).toContain('<v>5000</v>');
    expect(cellOf(xml, 'B9')).toBe('<c r="B9" s="9"><f>G9+H9+I9+J9+K9+L9+M9</f><v>1</v></c>');
    expect(cellOf(xml, 'N9')).toBe(
      '<c r="N9" s="10"><f>SUMPRODUCT(C9:M9,$C$7:$M$7)</f><v>5600</v></c>',
    );
    expect(cellOf(xml, 'O8')).toContain('<v>1</v>');
    expect(cellOf(xml, 'R8')).toContain('TEAM 1 (Thuế)');
    expect(cellOf(xml, 'A11')).toContain('>Cê<'); // Team 2 trống: không dòng, không gộp
    expect(cellOf(xml, 'R11')).toContain('TEAM 3');
    expect(xml).toContain(
      '<mergeCells count="7"><mergeCell ref="A1:A3"/><mergeCell ref="B1:P4"/><mergeCell ref="A6:A7"/><mergeCell ref="O8:O10"/><mergeCell ref="P8:P10"/><mergeCell ref="Q8:Q10"/><mergeCell ref="R8:R10"/></mergeCells>',
    );
    expect(cellOf(xml, 'B12')).toBe('<c r="B12" s="8"><f>SUM(B8:B11)</f><v>2</v></c>');
    expect(cellOf(xml, 'N12')).toBe('<c r="N12" s="30"><f>SUM(N8:N11)</f><v>5600</v></c>');
    expect(cellOf(xml, 'A13')).toContain('Hệ thống Tổng đài');
    expect(cellOf(xml, 'N15')).toContain('P. HCNS');
    expect(xml).toMatch(/<dimension ref="A1:R15"\/>/);
  });

  it('dòng Quản lý chỉ có tên, ô số trống', () => {
    expect(cellOf(xml, 'A8')).toContain('Quản &amp; Co');
    expect(cellOf(xml, 'B8')).toBe('<c r="B8" s="5"/>');
    expect(cellOf(xml, 'C8')).toBe('<c r="C8" s="6"/>');
    expect(cellOf(xml, 'N8')).toBe('<c r="N8" s="7"/>');
    expect(cellOf(xml, 'B8')).not.toContain('<f>');
  });

  it('không có dòng nào: TỔNG ghi 0 không công thức, dimension đúng', () => {
    const empty = reconcileSheetXml(sheet1, {
      ...data,
      teams: [{ teamId: 't1', label: 'TEAM 1', rows: [] }],
      totals: { counts: counts(), total: 0, money: 0 },
    });
    expect(cellOf(empty, 'A8')).toContain('TỔNG');
    expect(cellOf(empty, 'B8')).toBe('<c r="B8" s="8"><v>0</v></c>');
    expect(cellOf(empty, 'N8')).toBe('<c r="N8" s="30"><v>0</v></c>');
    expect(empty).not.toContain('<f>SUM');
    expect(empty).toMatch(/<dimension ref="A1:R11"\/>/);
    expect(empty).toContain('<mergeCells count="3">');
  });

  it('tên có & < và ký tự điều khiển được thoát', () => {
    const x = reconcileSheetXml(sheet1, {
      ...data,
      title: 'a<b',
      teams: [{ teamId: 't1', label: 'T&1', rows: [person('A<B&C\u0001D', counts(), 0, 0)] }],
    });
    expect(cellOf(x, 'A8')).toContain('A&lt;B&amp;CD');
    expect(cellOf(x, 'R8')).toContain('T&amp;1');
    expect(cellOf(x, 'B1')).toContain('a&lt;b');
    expect(x).not.toContain('\u0001');
  });
});

describe('fillReconcile', () => {
  it('zip mở lại được, các file khác giữ nguyên byte', () => {
    const out = unzipSync(fillReconcile(template, data));
    expect(Object.keys(out)).toEqual(Object.keys(files));
    for (const name of Object.keys(files)) {
      if (name === 'xl/worksheets/sheet1.xml') continue;
      expect(out[name]).toEqual(files[name]);
    }
    expect(strFromU8(out['xl/worksheets/sheet1.xml']!)).toContain('TIÊU ĐỀ');
  });
});
