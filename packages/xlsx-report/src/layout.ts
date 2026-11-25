import type { ReportType } from '@ts24-htkh/shared';

/** Vị trí ô của mẫu WR/MR/QR. Nguồn: REPORT_FORMS_ và hằng số liên quan trong Pure.js của HTKH-KPI. */
export interface ReportLayout {
  teamCols: readonly ['C', 'D', 'E'];
  signer: string;
  total: string;
  /** Độ rộng (ký tự) của C:E gộp trong mẫu. */
  merged: number;
  /** Độ rộng ký tự của ô; 0 khi mẫu cũ không ghi (ô không xuống dòng). */
  summary: Record<string, { cell: string; width: number }>;
  /** `stacked`: mỗi team một dòng ở cột C (row, row+1, row+2); không thì mỗi team một cột C-E. */
  team: Record<string, { row: number; stacked?: true }>;
}

const COLS = ['C', 'D', 'E'] as const;

export const REPORT_LAYOUT: Record<ReportType, ReportLayout> = {
  WR: {
    teamCols: COLS,
    signer: 'D60',
    total: 'B10',
    merged: 107,
    summary: {
      sla: { cell: 'B12', width: 18 },
      mttr: { cell: 'B14', width: 18 },
      backlog: { cell: 'B16', width: 18 },
      vanDe: { cell: 'B18', width: 125 },
      ceo: { cell: 'B20', width: 18 },
    },
    team: {
      slaTeam: { row: 41 },
      mttrTeam: { row: 42 },
      repeat: { row: 43 },
      vanDeTeam: { row: 49, stacked: true },
      keHoach: { row: 55, stacked: true },
    },
  },
  MR: {
    teamCols: COLS,
    signer: 'D55',
    total: 'B9',
    merged: 111,
    summary: {
      mrSla: { cell: 'B11', width: 18 },
      mrMttr: { cell: 'B13', width: 18 },
      mrBacklog: { cell: 'B15', width: 0 },
      mrXuHuong: { cell: 'C17', width: 35 },
      mrKpiSla: { cell: 'B24', width: 18 },
      mrSoSla: { cell: 'C24', width: 35 },
      mrKpiMttr: { cell: 'B25', width: 18 },
      mrSoMttr: { cell: 'C25', width: 35 },
      mrKpiRepeat: { cell: 'B26', width: 18 },
      mrSoRepeat: { cell: 'C26', width: 35 },
      mrKpiBacklog: { cell: 'B27', width: 18 },
      mrSoBacklog: { cell: 'C27', width: 35 },
      mrKpiCsat: { cell: 'B28', width: 18 },
      mrSoCsat: { cell: 'C28', width: 35 },
    },
    team: {
      mrHeThong: { row: 34 },
      mrNguoiDung: { row: 35 },
      mrQuyTrinh: { row: 36 },
      mrHaiLong: { row: 42 },
      mrTieuCuc: { row: 43 },
      mrNhayCam: { row: 44 },
      mrDeXuat: { row: 48, stacked: true },
    },
  },
  QR: {
    teamCols: COLS,
    signer: 'D55',
    total: 'B9',
    merged: 107,
    summary: {
      qrSla: { cell: 'B11', width: 18 },
      qrMttr: { cell: 'B13', width: 18 },
      qrRepeat: { cell: 'B15', width: 18 },
      qrXuHuong: { cell: 'B17', width: 125 },
    },
    team: {
      qrLoiTang: { row: 25 },
      qrDoanhThu: { row: 26 },
      qrPhienBan: { row: 27 },
      qrNangSuat: { row: 33 },
      qrVuotSla: { row: 35 },
      qrLapLai: { row: 41 },
      qrNhanSu: { row: 42 },
      qrQuaTai: { row: 43 },
      qrDeXuat: { row: 48, stacked: true },
    },
  },
};

/** Dòng WR điền theo team (cột C-E). */
export const WR_ROWS = { tongDai: 27, chat: 28, email: 29, hoanThanh: 30, loi: 33, cauHinh: 34, hoTro: 35 } as const;
export const QR_PER_PERSON_ROW = 34;
export const MR_TREND = { total: 'B23', arrow: 'C23', clear: ['C24', 'C25', 'C26', 'C27', 'C28'] } as const;

export const REPORT_LINE_PT = 15.75;
export const REPORT_MAX_ROW_PT = 409;
