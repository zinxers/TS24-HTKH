import type { ReportType } from '@ts24-htkh/shared';
import { REPORT_LAYOUT, REPORT_LINE_PT, REPORT_MAX_ROW_PT } from './layout';

export type CellValue = number | string | null;
export type Cells = Record<string, CellValue>;

// Bỏ ký tự điều khiển XML không cho phép (giữ \t \n \r), thoát & < >.
export function xmlText(v: string): string {
  return v
    // eslint-disable-next-line no-control-regex -- cố ý: loại ký tự điều khiển XML cấm
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Ghi giá trị vào ô của sheet1.xml, mỗi ô giữ thuộc tính style `s` nên mẫu giữ nguyên giao diện. */
export function fillSheetXml(xml: string, cells: Cells): string {
  let out = xml;
  for (const [ref, v] of Object.entries(cells)) {
    const re = new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>[\\s\\S]*?</c>)`);
    if (!re.test(out)) throw new Error(`Không thấy ô ${ref} trong file mẫu`);
    out = out.replace(re, (_m, attrs: string) => {
      const style = / s="\d+"/.exec(attrs)?.[0] ?? '';
      const open = `<c r="${ref}"${style}`;
      if (v === null) return `${open}/>`;
      if (typeof v === 'number') return `${open}><v>${v}</v></c>`;
      const text = xmlText(v);
      const space = /\n|^\s|\s$/.test(text) ? ' xml:space="preserve"' : '';
      return `${open} t="inlineStr"><is><t${space}>${text}</t></is></c>`;
    });
  }
  return out;
}

// Độ rộng ký tự của ô chứa chữ form trong mẫu; 0 với ô khác.
function noteWidth(type: ReportType, ref: string): number {
  const layout = REPORT_LAYOUT[type];
  const summary = Object.values(layout.summary).find((f) => f.cell === ref);
  if (summary) return summary.width;
  const m = /^([CDE])(\d+)$/.exec(ref);
  if (!m) return 0;
  const row = Number(m[2]);
  const field = Object.values(layout.team).find((f) =>
    f.stacked ? m[1] === 'C' && row >= f.row && row <= f.row + 2 : row === f.row,
  );
  return !field ? 0 : field.stacked ? layout.merged : 35;
}

/**
 * Tăng chiều cao dòng có chữ dài hơn mẫu cho phép; không bao giờ hạ.
 * shortcut: đếm ký tự, không đo font thật nên dòng có thể cao hơn một chút; nâng cấp khi lệch rõ trên Excel.
 */
export function growRowHeights(xml: string, cells: Cells, type: ReportType): string {
  const need = new Map<string, number>();
  for (const [ref, v] of Object.entries(cells)) {
    const width = noteWidth(type, ref);
    if (!width || typeof v !== 'string') continue;
    const lines = v.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / width)), 0);
    const row = ref.replace(/\D/g, '');
    need.set(row, Math.max(need.get(row) ?? 0, Math.min(REPORT_MAX_ROW_PT, lines * REPORT_LINE_PT + 3)));
  }
  let out = xml;
  for (const [row, ht] of need) {
    out = out.replace(new RegExp(`<row r="${row}"[^>]*>`), (tag) => {
      const cur = / ht="([\d.]+)"/.exec(tag);
      if (cur && Number(cur[1]) >= ht) return tag;
      const grown = cur ? tag.replace(cur[0], ` ht="${ht}"`) : tag.replace(`<row r="${row}"`, `<row r="${row}" ht="${ht}"`);
      return / customHeight=/.test(grown) ? grown : grown.replace(' ht="', ' customHeight="1" ht="');
    });
  }
  return out;
}
