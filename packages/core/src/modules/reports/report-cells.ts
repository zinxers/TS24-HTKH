// Ô cần ghi vào mẫu WR/MR/QR. Chuyển nguyên từ HTKH-KPI/app/src/Pure.js: periodicCounts, reportCells, addWeeklyNotes_.
import {
  DEPT_SCOPE,
  KENH_GROUPS,
  REPORT_FIELDS,
  parts,
  type IsoDate,
  type ReportScope,
  type ReportType,
  type Role,
} from '@ts24-htkh/shared';
import { MR_TREND, QR_PER_PERSON_ROW, REPORT_LAYOUT, WR_ROWS, type Cells } from '@ts24-htkh/xlsx-report';

export interface TeamCounts {
  total: number;
  tongDai: number;
  chat: number;
  email: number;
  loi: number;
  cauHinh: number;
  hoTro: number;
  people: number;
}

export const COLS = REPORT_LAYOUT.WR.teamCols;

/** Nhãn dòng xem trước; dòng ô lấy từ WR_ROWS. */
export const WR_LINES: { label: string; key: keyof typeof WR_ROWS; value: (c: TeamCounts) => number }[] = [
  { label: 'Tổng đài (ĐT)', key: 'tongDai', value: (c) => c.tongDai },
  { label: 'Chat', key: 'chat', value: (c) => c.chat },
  { label: 'Email', key: 'email', value: (c) => c.email },
  { label: 'Hoàn thành', key: 'hoanThanh', value: (c) => c.tongDai + c.chat + c.email },
  { label: 'Lỗi hệ thống, lỗi tích hợp', key: 'loi', value: (c) => c.loi },
  { label: 'Cấu hình phần mềm', key: 'cauHinh', value: (c) => c.cauHinh },
  { label: 'Hỗ trợ sử dụng', key: 'hoTro', value: (c) => c.hoTro },
];
export const QR_LINE_LABEL = 'Ticket xử lý / nhân sự';

const group = (name: string): readonly string[] => KENH_GROUPS.find((g) => g.name === name)?.kenh ?? [];
const TONG_DAI = group('PI / PO');
const CHAT = group('Chat');
const EMAIL = group('Email');

/** Đếm một team từ `teamCells`. Kênh khác (Teamviewer, Trường hợp khó, Chăm sóc KH) chỉ vào `total`. */
export function teamCounts(rows: { userId: string; kenh: string; phanLoai: string; count: number }[]): TeamCounts {
  const c: TeamCounts = { total: 0, tongDai: 0, chat: 0, email: 0, loi: 0, cauHinh: 0, hoTro: 0, people: 0 };
  const people = new Set<string>();
  for (const r of rows) {
    c.total += r.count;
    people.add(r.userId);
    if (TONG_DAI.includes(r.kenh)) c.tongDai += r.count;
    else if (CHAT.includes(r.kenh)) c.chat += r.count;
    else if (EMAIL.includes(r.kenh)) c.email += r.count;
    if (r.phanLoai === 'Lỗi hệ thống, lỗi tích hợp') c.loi += r.count;
    else if (r.phanLoai === 'Cấu hình phần mềm') c.cauHinh += r.count;
    else if (r.phanLoai === 'Hỗ trợ sử dụng') c.hoTro += r.count;
  }
  c.people = people.size;
  return c;
}

export interface CellOptions {
  label: string;
  sentDay: IsoDate;
  role: Role;
  /** Chỉ MR. */
  prevTotal: number;
  running: boolean;
  notes: Record<ReportScope, Record<string, string>>;
  /** teamId của từng cột C-E (theo sort_order). */
  teamIds: (string | null)[];
}

const vnDay = (d: IsoDate) => {
  const p = parts(d);
  return `${String(p.day).padStart(2, '0')}/${String(p.month).padStart(2, '0')}/${p.year}`;
};

/** `counts[i]` null = cột ngoài phạm vi người xuất; ô không có key giữ nguyên như mẫu. */
export function reportCells(type: ReportType, counts: (TeamCounts | null)[], o: CellOptions): Cells {
  const layout = REPORT_LAYOUT[type];
  const cells: Cells = { A6: o.label, B5: `Ngày gửi: ${vnDay(o.sentDay)}` };
  cells[layout.signer] = `${o.role === 'manager' ? 'PP.' : 'TP.'} Hỗ Trợ Khách Hàng`;
  let total = 0;
  let tiepNhan = 0;
  let phanLoai = 0;
  counts.forEach((c, i) => {
    if (!c) return;
    total += c.total;
    tiepNhan += c.tongDai + c.chat + c.email;
    phanLoai += c.loi + c.cauHinh + c.hoTro;
    if (type === 'WR') for (const l of WR_LINES) cells[`${COLS[i]}${WR_ROWS[l.key]}`] = l.value(c);
    if (type === 'QR' && c.people) cells[`${COLS[i]}${QR_PER_PERSON_ROW}`] = Math.round((c.total / c.people) * 10) / 10;
  });
  cells[layout.total] = type === 'WR' ? Math.max(tiepNhan, phanLoai) : total;
  if (type === 'MR') {
    cells[MR_TREND.total] = total;
    // Kỳ đang chạy ít ngày hơn kỳ trước: không mũi tên thay vì báo giảm sai.
    cells[MR_TREND.arrow] = o.running ? null : total > o.prevTotal ? '↑' : total < o.prevTotal ? '↓' : '=';
    for (const ref of MR_TREND.clear) cells[ref] = null; // mũi tên mẫu
  }
  addNotes(cells, type, counts, o);
  return cells;
}

/** Tóm tắt: Trưởng phòng từ Cả phòng, Quản lý từ team mình. Chữ rỗng giữ ô như mẫu. */
function addNotes(cells: Cells, type: ReportType, counts: (TeamCounts | null)[], o: CellOptions): void {
  const layout = REPORT_LAYOUT[type];
  const put = (ref: string, text: string | undefined) => {
    if (text && text.trim()) cells[ref] = text;
  };
  const own = o.teamIds.find((_, i) => counts[i]) ?? null;
  const summary = (o.role === 'manager' ? (own ? o.notes[own] : undefined) : o.notes[DEPT_SCOPE]) ?? {};
  for (const f of REPORT_FIELDS[type].summary) put(layout.summary[f.key]!.cell, summary[f.key]);
  counts.forEach((c, i) => {
    const teamId = o.teamIds[i];
    if (!c || !teamId) return;
    const texts = o.notes[teamId] ?? {};
    for (const f of REPORT_FIELDS[type].team) {
      const at = layout.team[f.key]!;
      put(at.stacked ? `C${at.row + i}` : `${COLS[i]}${at.row}`, texts[f.key]);
    }
  });
}
