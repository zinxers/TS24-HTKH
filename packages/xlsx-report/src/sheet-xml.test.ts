import { describe, expect, it } from 'vitest';
import { fillSheetXml, growRowHeights } from './sheet-xml';

describe('fillSheetXml', () => {
  it('ghi số, chữ, xóa ô và giữ thuộc tính s', () => {
    const xml =
      '<row r="1"><c r="A1" s="3" t="s"><v>7</v></c><c r="B1" s="4"/><c r="C1" s="5" t="s"><v>9</v></c><c r="D1" s="6"/></row>';
    expect(fillSheetXml(xml, { A1: 'A & <B> "q"', B1: 12, C1: null, D1: 0 })).toBe(
      '<row r="1"><c r="A1" s="3" t="inlineStr"><is><t>A &amp; &lt;B&gt; "q"</t></is></c><c r="B1" s="4"><v>12</v></c><c r="C1" s="5"/><c r="D1" s="6"><v>0</v></c></row>',
    );
  });

  it('chữ có xuống dòng hoặc khoảng trắng đầu/cuối thì xml:space="preserve"', () => {
    expect(fillSheetXml('<c r="A1" s="1"/>', { A1: 'a\nb' })).toBe(
      '<c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">a\nb</t></is></c>',
    );
    expect(fillSheetXml('<c r="A1"/>', { A1: ' a ' })).toContain('<t xml:space="preserve"> a </t>');
  });

  it('bỏ ký tự điều khiển và U+FFFE/U+FFFF', () => {
    expect(fillSheetXml('<c r="A1"/>', { A1: 'a\u000bb\u0001c￾d￿e' })).toBe(
      '<c r="A1" t="inlineStr"><is><t>abcde</t></is></c>',
    );
  });

  it('không nhầm A1 với A10; ô không có thì lỗi', () => {
    expect(fillSheetXml('<c r="A10" s="1"/><c r="A1" s="2"/>', { A1: 1 })).toBe(
      '<c r="A10" s="1"/><c r="A1" s="2"><v>1</v></c>',
    );
    expect(() => fillSheetXml('<c r="A1"/>', { Z99: 1 })).toThrow('Không thấy ô Z99 trong file mẫu');
  });
});

describe('growRowHeights', () => {
  it('chỉ tăng ht, không giảm, tối đa 409', () => {
    const xml =
      '<row r="41" spans="1:5" ht="54" customHeight="1"><c r="D41"/></row><row r="49" ht="153.75" customHeight="1"><c r="C49"/></row><row r="55" ht="100" customHeight="1"/>';
    const out = growRowHeights(xml, { D41: 'x'.repeat(130), C49: 'ngắn', C55: 'y'.repeat(9000) }, 'WR');
    expect(out).toContain('<row r="41" spans="1:5" ht="66" customHeight="1">');
    expect(out).toContain('<row r="49" ht="153.75" customHeight="1">');
    expect(out).toContain('<row r="55" ht="409" customHeight="1"/>');
  });

  it('đếm xuống dòng, bỏ qua ô khác', () => {
    const xml = '<row r="55" ht="20" customHeight="1"/><row r="6" ht="20" customHeight="1"/>';
    const out = growRowHeights(xml, { C55: 'a\nb\nc', A6: 'x'.repeat(500), C27: 12 }, 'WR');
    expect(out).toContain('<row r="55" ht="50.25" customHeight="1"/>');
    expect(out).toContain('<row r="6" ht="20" customHeight="1"/>');
  });

  it('thêm customHeight="1" khi dòng chưa có', () => {
    const out = growRowHeights('<row r="55" ht="10"/>', { C55: 'a\nb' }, 'WR');
    expect(out).toBe('<row r="55" customHeight="1" ht="34.5"/>');
  });

  it('mỗi loại báo cáo đo bằng độ rộng riêng', () => {
    const rows = '<row r="17" ht="15" customHeight="1"/><row r="34" ht="15" customHeight="1"/><row r="48" ht="15" customHeight="1"/>';
    const month = growRowHeights(rows, { C17: 'x'.repeat(70), C34: 'x'.repeat(70), C48: 'x'.repeat(222) }, 'MR');
    expect(month).toContain('<row r="17" ht="34.5"');
    expect(month).toContain('<row r="34" ht="34.5"');
    expect(month).toContain('<row r="48" ht="34.5"');
    expect(growRowHeights(rows, { B17: 'x'.repeat(250) }, 'QR')).toContain('<row r="17" ht="34.5"');
  });
});
