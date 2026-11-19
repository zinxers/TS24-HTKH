import type { NewKpiReport } from '@ts24-htkh/db';
import {
  checkKpiRow,
  KENH,
  PHAN_LOAI,
  type CurrentUser,
  type Kenh,
  type KpiRange,
  type KpiRowResult,
  type KpiSubmitResult,
  type MyKpi,
  type PhanLoai,
} from '@ts24-htkh/shared';
import type { KpiRateStore, KpiReportStore, UnitOfWork } from '../../unit-of-work';
import { KpiPolicy } from './kpi.policy';

export interface KpiReportServiceDeps {
  kpiReports: KpiReportStore;
  kpiRates: KpiRateStore;
  uow: UnitOfWork;
  now?: () => Date;
}

export class KpiReportService {
  constructor(private readonly deps: KpiReportServiceDeps) {}

  /**
   * Lưu một phần: dòng lỗi trả lỗi theo dòng, dòng hợp lệ vẫn ghi. Họ tên, team lấy từ actor (đã đọc lại từ DB).
   * row_id đã có (trùng trong lần gửi, gửi lại, của người khác) bị DB bỏ qua và vẫn trả ok, không tạo dòng mới.
   */
  async submit(actor: CurrentUser, rows: unknown[]): Promise<KpiSubmitResult> {
    KpiPolicy.assert(actor, 'kpi.submit');
    const createdAt = (this.deps.now?.() ?? new Date()).toISOString();
    const toInsert = new Map<string, NewKpiReport>();
    const results = rows.map((input): KpiRowResult => {
      const { rowId, row, errors } = checkKpiRow(input);
      if (!row) return { rowId, status: 'error', errors };
      if (!toInsert.has(row.rowId)) {
        toInsert.set(row.rowId, {
          rowId: row.rowId,
          userId: actor.id,
          fullName: actor.fullName,
          teamId: actor.teamId,
          ticket: row.ticket,
          kenh: row.kenh,
          phanLoai: row.phanLoai,
          noiDung: row.noiDung,
        });
      }
      return { rowId, status: 'ok' };
    });
    if (toInsert.size > 0) {
      await this.deps.uow.transaction(({ kpiReports }) => kpiReports.insertMany([...toInsert.values()]));
    }
    return { createdAt, results };
  }

  /** Chỉ dữ liệu của chính người gọi. */
  async mine(actor: CurrentUser, range: KpiRange): Promise<MyKpi> {
    const r = this.deps.kpiReports;
    const [summary, phanLoai, byDay, items, rates] = await Promise.all([
      r.summaryByKenh(actor.id, range),
      r.countByPhanLoai(actor.id, range),
      r.countByDay(actor.id, range),
      r.listMine(actor.id, range),
      this.deps.kpiRates.todayRates(),
    ]);
    const lines = KENH.map((kenh) => {
      const s = summary.find((x) => x.kenh === kenh);
      if (!s) return { kenh, soLuong: 0, donGia: rates[kenh] ?? null, thanhTien: 0 };
      return { kenh, soLuong: s.count, donGia: s.distinctAmounts > 1 ? null : s.amount, thanhTien: s.total };
    });
    const byPhanLoai = Object.fromEntries(PHAN_LOAI.map((p) => [p, 0])) as Record<PhanLoai, number>;
    for (const p of phanLoai) byPhanLoai[p.phanLoai as PhanLoai] = p.count;
    return {
      lines,
      tongSoLuong: lines.reduce((n, l) => n + l.soLuong, 0),
      tongTien: lines.reduce((n, l) => n + l.thanhTien, 0),
      byPhanLoai,
      byDay,
      items: items.map((i) => ({
        createdAt: i.created_at,
        ticket: i.ticket,
        kenh: i.kenh as Kenh,
        phanLoai: i.phan_loai as PhanLoai,
        noiDung: i.noi_dung,
        amount: i.amount,
      })),
    };
  }
}
