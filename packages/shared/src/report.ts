import type { ReportType } from './period';

/** Trường chữ của một báo cáo. Nguồn: REPORT_FORMS_ của hệ thống cũ HTKH-KPI (bỏ vị trí ô, chỉ giữ nhãn). */
export interface ReportField {
  key: string;
  section: string;
  label: string;
  long?: true;
}

/** `summary`: phần phòng (scope 'dept'); `team`: phần riêng từng team. Key duy nhất trên cả 3 loại. */
export const REPORT_FIELDS: Record<ReportType, { summary: readonly ReportField[]; team: readonly ReportField[] }> = {
  WR: {
    summary: [
      { key: 'sla', section: 'I', label: 'SLA đạt' },
      { key: 'mttr', section: 'I', label: 'MTTR' },
      { key: 'backlog', section: 'I', label: 'Backlog cuối tuần' },
      { key: 'vanDe', section: 'I', label: 'Vấn đề nổi bật', long: true },
      { key: 'ceo', section: 'I', label: 'Hỗ trợ cần từ CEO (nếu có)', long: true },
    ],
    team: [
      { key: 'slaTeam', section: 'III', label: 'SLA Compliance', long: true },
      { key: 'mttrTeam', section: 'III', label: 'MTTR', long: true },
      { key: 'repeat', section: 'III', label: 'Repeat Rate', long: true },
      { key: 'vanDeTeam', section: 'IV', label: 'Vấn đề nổi bật', long: true },
      { key: 'keHoach', section: 'V', label: 'Kế hoạch tuần tới', long: true },
    ],
  },
  MR: {
    summary: [
      { key: 'mrSla', section: 'I', label: 'SLA trung bình' },
      { key: 'mrMttr', section: 'I', label: 'MTTR trung bình' },
      { key: 'mrBacklog', section: 'I', label: 'Backlog cuối tháng' },
      { key: 'mrXuHuong', section: 'I', label: 'Xu hướng so với tháng trước', long: true },
      { key: 'mrKpiSla', section: 'II', label: 'SLA Compliance' },
      { key: 'mrSoSla', section: 'II', label: 'SLA Compliance: so với tháng trước' },
      { key: 'mrKpiMttr', section: 'II', label: 'MTTR' },
      { key: 'mrSoMttr', section: 'II', label: 'MTTR: so với tháng trước' },
      { key: 'mrKpiRepeat', section: 'II', label: 'Repeat Rate' },
      { key: 'mrSoRepeat', section: 'II', label: 'Repeat Rate: so với tháng trước' },
      { key: 'mrKpiBacklog', section: 'II', label: 'Backlog' },
      { key: 'mrSoBacklog', section: 'II', label: 'Backlog: so với tháng trước' },
      { key: 'mrKpiCsat', section: 'II', label: 'CSAT' },
      { key: 'mrSoCsat', section: 'II', label: 'CSAT: so với tháng trước' },
    ],
    team: [
      { key: 'mrHeThong', section: 'III', label: 'Lỗi do hệ thống', long: true },
      { key: 'mrNguoiDung', section: 'III', label: 'Lỗi do người dùng', long: true },
      { key: 'mrQuyTrinh', section: 'III', label: 'Lỗi do quy trình', long: true },
      { key: 'mrHaiLong', section: 'IV', label: 'Tỷ lệ khách hàng hài lòng (% hoàn thành)', long: true },
      { key: 'mrTieuCuc', section: 'IV', label: 'Phản hồi tiêu cực', long: true },
      { key: 'mrNhayCam', section: 'IV', label: 'Nhóm khách hàng nhạy cảm', long: true },
      { key: 'mrDeXuat', section: 'V', label: 'Đề xuất cải tiến', long: true },
    ],
  },
  QR: {
    summary: [
      { key: 'qrSla', section: 'I', label: 'SLA trung bình' },
      { key: 'qrMttr', section: 'I', label: 'MTTR trung bình' },
      { key: 'qrRepeat', section: 'I', label: 'Repeat Rate' },
      { key: 'qrXuHuong', section: 'I', label: 'Xu hướng 3 tháng', long: true },
    ],
    team: [
      { key: 'qrLoiTang', section: 'II', label: 'Lỗi tăng', long: true },
      { key: 'qrDoanhThu', section: 'II', label: 'Tác động đến doanh thu', long: true },
      { key: 'qrPhienBan', section: 'II', label: 'Liên quan phiên bản cập nhật', long: true },
      { key: 'qrNangSuat', section: 'III', label: 'Năng suất trung bình / nhân sự', long: true },
      { key: 'qrVuotSla', section: 'III', label: 'Tỷ lệ vượt SLA', long: true },
      { key: 'qrLapLai', section: 'IV', label: 'Lỗi hệ thống lặp lại', long: true },
      { key: 'qrNhanSu', section: 'IV', label: 'Phụ thuộc nhân sự chủ chốt (nếu có)', long: true },
      { key: 'qrQuaTai', section: 'IV', label: 'Rủi ro quá tải', long: true },
      { key: 'qrDeXuat', section: 'V', label: 'Đề xuất chiến lược quý tới', long: true },
    ],
  },
};

export const DEPT_SCOPE = 'dept';
/** 'dept' hoặc teamId. */
export type ReportScope = string;

export const MAX_NOTE_TEXT = 2000;

export function reportFieldsFor(type: ReportType, scope: ReportScope): readonly ReportField[] {
  const f = REPORT_FIELDS[type];
  return scope === DEPT_SCOPE ? f.summary : [...f.summary, ...f.team];
}
