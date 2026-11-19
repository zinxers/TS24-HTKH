import type { IsoDate } from './date';

// Nguồn duy nhất phía TS của danh mục KPI. DB có check constraint cùng danh sách (migration kpi_report_rate).
export const KENH = [
  'PI Hoàn Thành',
  'PO Hoàn Thành',
  'PI Nhận thông tin',
  'PO Nhận thông tin',
  'Teamviewer Hoàn Thành',
  'Email Nhận thông tin',
  'Email Hoàn Thành',
  'Chat Nhận thông tin',
  'Chat Hoàn Thành',
  'Trường hợp khó',
  'Chăm sóc KH',
] as const;
export type Kenh = (typeof KENH)[number];

export const PHAN_LOAI = ['Hỗ trợ sử dụng', 'Cấu hình phần mềm', 'Lỗi hệ thống, lỗi tích hợp'] as const;
export type PhanLoai = (typeof PHAN_LOAI)[number];

/** 11 kênh hiển thị thành 6 nhóm; mỗi kênh thuộc đúng một nhóm. */
export const KENH_GROUPS: readonly { name: string; kenh: readonly Kenh[] }[] = [
  { name: 'PI / PO', kenh: ['PI Hoàn Thành', 'PO Hoàn Thành', 'PI Nhận thông tin', 'PO Nhận thông tin'] },
  { name: 'Teamviewer', kenh: ['Teamviewer Hoàn Thành'] },
  { name: 'Email', kenh: ['Email Nhận thông tin', 'Email Hoàn Thành'] },
  { name: 'Chat', kenh: ['Chat Nhận thông tin', 'Chat Hoàn Thành'] },
  { name: 'Trường hợp khó', kenh: ['Trường hợp khó'] },
  { name: 'Chăm sóc KH', kenh: ['Chăm sóc KH'] },
];

export const DEFAULT_KPI_RATES: Record<Kenh, number> = {
  'PI Hoàn Thành': 1000,
  'PO Hoàn Thành': 1000,
  'PI Nhận thông tin': 600,
  'PO Nhận thông tin': 600,
  'Teamviewer Hoàn Thành': 2000,
  'Email Nhận thông tin': 600,
  'Email Hoàn Thành': 1500,
  'Chat Nhận thông tin': 600,
  'Chat Hoàn Thành': 1500,
  'Trường hợp khó': 4000,
  'Chăm sóc KH': 5000,
};

export const MAX_ROWS_PER_SUBMIT = 200;
export const MAX_NOI_DUNG = 1000;
export const MAX_RATE = 1_000_000;
export const MAX_RANGE_DAYS = 400;

export type KpiRowResult =
  | { rowId: string; status: 'ok' }
  | { rowId: string; status: 'error'; errors: { field: string; message: string }[] };

export interface KpiSubmitResult {
  createdAt: string;
  results: KpiRowResult[];
}

export interface KpiLine {
  kenh: Kenh;
  soLuong: number;
  donGia: number | null;
  thanhTien: number;
}

export interface MyKpiItem {
  createdAt: string;
  ticket: string;
  kenh: Kenh;
  phanLoai: PhanLoai;
  noiDung: string;
  amount: number;
}

export interface MyKpi {
  lines: KpiLine[];
  tongSoLuong: number;
  tongTien: number;
  byPhanLoai: Record<PhanLoai, number>;
  byDay: { date: IsoDate; count: number }[];
  items: MyKpiItem[];
}

export interface RateVersion {
  from: IsoDate;
  rates: Record<Kenh, number>;
  createdBy: string | null;
  createdAt: string;
}
