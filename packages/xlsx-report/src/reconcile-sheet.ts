import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { RECONCILE_TOTAL_KENH, type Reconcile } from '@ts24-htkh/shared';
import { xmlText } from './sheet-xml';

export type ReconcileSheetData = Pick<Reconcile, 'kenh' | 'rates' | 'teams' | 'totals' | 'title'>;

const SHEET = 'xl/worksheets/sheet1.xml';
const COLS = 'ABCDEFGHIJKLMNOPQR';
const RATE_ROW = 7;
const FIRST = 8;

/**
 * Dựng sheetData, dimension, mergeCells của sheet "Đối soát" (mã kiểu `s` lấy từ mẫu).
 * Dòng 1–4 đầu form, 6 tiêu đề cột, 7 đơn giá, 8.. khối team, TỔNG, Hệ thống Tổng đài, chữ ký.
 * B = G+…+M, N = SUMPRODUCT(đếm, đơn giá), TỔNG = SUM từng cột; công thức kèm giá trị đã tính.
 * Dòng Quản lý chỉ có tên, ô số để trống; không có dòng "TICKET NV ĐÃ XỬ LÝ".
 */
export function reconcileSheetXml(xml: string, d: ReconcileSheetData): string {
  let cells = '';
  let rows = '';
  const merges = ['A1:A3', 'B1:P4', 'A6:A7'];
  const text = (c: string, r: number, s: number, v: string) => {
    cells += `<c r="${c}${r}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xmlText(v)}</t></is></c>`;
  };
  const num = (c: string, r: number, s: number, v: number, f?: string) => {
    cells += `<c r="${c}${r}" s="${s}">${f ? `<f>${f}</f>` : ''}<v>${v}</v></c>`;
  };
  const blank = (c: string, r: number, s: number) => {
    cells += `<c r="${c}${r}" s="${s}"/>`;
  };
  const row = (r: number, ht?: string) => {
    rows += `<row r="${r}"${ht ? ` ht="${ht}" customHeight="1"` : ''}>${cells}</row>`;
    cells = '';
  };
  const kcol = (i: number) => COLS[2 + i]!; // kênh i → C..M

  const form: [string, number, string | null, number][] = [
    ['Số hiệu', 14, 'HTKH-ĐS-KPI', 15],
    ['Số soát xét', 16, null, 17],
    ['Ngày ban hành', 18, '15.11.2019', 15],
    ['Cấp BM', 16, 'H', 15],
  ];
  form.forEach(([label, ls, value, vs], i) => {
    const r = i + 1;
    if (r === 4) text('A', r, 19, '    Công ty CP TS24');
    else blank('A', r, 36);
    if (r === 1) text('B', r, 38, d.title);
    else blank('B', r, 38);
    for (let c = 2; c <= 15; c++) blank(COLS[c]!, r, 38);
    text('Q', r, ls, label);
    if (value === null) num('R', r, vs, 1); // Số soát xét là số trong mẫu
    else text('R', r, vs, value);
    row(r, '12');
  });
  blank('A', 5, 27);
  row(5, '9');
  text('A', 6, 37, 'Nhân viên');
  [
    'Tổng các hình thức xử lý',
    ...d.kenh,
    'KPI',
    'Tỷ lệ hoàn thành',
    'Số lương đánh giá',
    'Tỷ lệ đánh giá 5 sao',
    'Ghi chú',
  ].forEach((t, i) => text(COLS[i + 1]!, 6, 2, t));
  row(6, '51');
  blank('A', 7, 37);
  blank('B', 7, 2);
  d.rates.forEach((v, i) => num(kcol(i), RATE_ROW, 2, v));
  blank('N', 7, 2);
  text('O', 7, 2, '%');
  text('P', 7, 2, '%');
  text('Q', 7, 2, '%');
  blank('R', 7, 2);
  row(7, '12');

  let r = FIRST;
  const totalCols = RECONCILE_TOTAL_KENH.map((k) => kcol(d.kenh.indexOf(k)));
  for (const t of d.teams) {
    const top = r;
    for (const x of t.rows) {
      text('A', r, x.manager ? 4 : 8, x.name);
      if (x.manager) {
        blank('B', r, 5);
        for (let c = 2; c <= 12; c++) blank(COLS[c]!, r, 6);
        blank('N', r, 7);
      } else {
        num('B', r, 9, x.total, totalCols.map((c) => `${c}${r}`).join('+'));
        d.kenh.forEach((k, i) => num(kcol(i), r, 9, x.counts[k]));
        num('N', r, 10, x.money, `SUMPRODUCT(C${r}:M${r},$C$${RATE_ROW}:$M$${RATE_ROW})`);
      }
      if (r === top) {
        num('O', r, 33, 1);
        blank('P', r, 35);
        blank('Q', r, 35);
        text('R', r, 32, t.label);
      } else {
        blank('O', r, 34);
        blank('P', r, 34);
        blank('Q', r, 34);
        blank('R', r, 32);
      }
      row(r, '12');
      r++;
    }
    if (r - top > 1) for (const c of ['O', 'P', 'Q', 'R']) merges.push(`${c}${top}:${c}${r - 1}`);
  }
  const last = r - 1;
  text('A', r, 12, 'TỔNG');
  const sum = (c: string, s: number, v: number) => {
    if (last >= FIRST) num(c, r, s, v, `SUM(${c}${FIRST}:${c}${last})`);
    else num(c, r, s, 0);
  };
  sum('B', 8, d.totals.total);
  d.kenh.forEach((k, i) => sum(kcol(i), 8, d.totals.counts[k]));
  sum('N', 30, d.totals.money);
  blank('O', r, 20);
  blank('P', r, 21);
  blank('Q', r, 21);
  blank('R', r, 25);
  row(r, '17.45');
  r++;
  text('A', r, 12, 'Hệ thống Tổng đài');
  blank('B', r, 26);
  for (let c = 2; c <= 8; c++) blank(COLS[c]!, r, 8);
  for (let c = 9; c <= 13; c++) blank(COLS[c]!, r, 25);
  blank('O', r, 20);
  blank('P', r, 21);
  blank('Q', r, 21);
  blank('R', r, 21);
  row(r, '17.45');
  r += 2;
  text('B', r, 3, 'P. HTKH');
  text('H', r, 3, 'P. IT');
  text('N', r, 3, 'P. HCNS');
  row(r);

  const mergeXml = `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`;
  return xml
    .replace(/<dimension[^>]*\/>/, () => `<dimension ref="A1:R${r}"/>`)
    .replace(/<sheetData>[\s\S]*<\/sheetData>/, () => `<sheetData>${rows}</sheetData>`)
    .replace(/<mergeCells[\s\S]*?<\/mergeCells>/, () => mergeXml);
}

/** Điền mẫu doi-soat.xlsx; chỉ sửa sheet1.xml, mọi file khác trong zip giữ nguyên byte. */
export function fillReconcile(template: Uint8Array, d: ReconcileSheetData): Uint8Array {
  const files = unzipSync(template);
  const sheet = files[SHEET];
  if (!sheet) throw new Error(`Không thấy ${SHEET} trong file mẫu`);
  files[SHEET] = strToU8(reconcileSheetXml(strFromU8(sheet), d));
  return zipSync(files);
}
