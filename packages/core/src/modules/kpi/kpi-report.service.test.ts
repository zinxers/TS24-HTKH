import type { KenhSummary, KpiItemRow, NewKpiReport } from '@ts24-htkh/db';
import { isoDate, KENH, type CurrentUser, type KpiRange } from '@ts24-htkh/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import type { KpiRateStore, KpiReportStore, Repos, UnitOfWork } from '../../unit-of-work';
import { KpiReportService } from './kpi-report.service';

const TEAM_A = '00000000-0000-4000-8000-00000000000a';
const S: CurrentUser = { id: 'S', email: 's@example.com', fullName: 'Nhân Viên S', role: 'staff', teamId: TEAM_A };
const H: CurrentUser = { id: 'H', email: 'h@example.com', fullName: 'Trưởng Phòng H', role: 'head', teamId: null };
const NOW = new Date('2026-11-19T16:30:00.000Z');
const RANGE: KpiRange = { from: isoDate('2026-10-16'), to: isoDate('2026-11-15') };

const valid = (rowId: string, extra: Record<string, unknown> = {}) => ({
  rowId,
  ticket: 'ticket/ 123',
  kenh: 'PI Hoàn Thành',
  phanLoai: 'Hỗ trợ sử dụng',
  noiDung: 'Hỗ trợ cài đặt',
  ...extra,
});

class Fake {
  /** row_id → dòng đã có trong DB (của bất kỳ ai). */
  db = new Map<string, NewKpiReport>();
  inserted: NewKpiReport[][] = [];
  calls: string[] = [];
  summary: KenhSummary[] = [];
  rates: Record<string, number> = Object.fromEntries(KENH.map((k, i) => [k, 1000 * (i + 1)]));

  kpiReports: KpiReportStore = {
    insertMany: async (rows) => {
      this.inserted.push(rows);
      const ids: string[] = [];
      for (const r of rows) {
        if (this.db.has(r.rowId)) continue;
        this.db.set(r.rowId, r);
        ids.push(r.rowId);
      }
      return ids;
    },
    summaryByKenh: async (userId) => {
      this.calls.push(`summary:${userId}`);
      return this.summary;
    },
    countByPhanLoai: async (userId) => {
      this.calls.push(`phanLoai:${userId}`);
      return [{ phanLoai: 'Cấu hình phần mềm', count: 2 }];
    },
    countByDay: async (userId) => {
      this.calls.push(`day:${userId}`);
      return [{ date: isoDate('2026-11-01'), count: 2 }];
    },
    listMine: async (userId) => {
      this.calls.push(`list:${userId}`);
      return [...this.db.values()]
        .filter((r) => r.userId === userId)
        .map(
          (r): KpiItemRow => ({
            created_at: '2026-11-01T01:00:00.000Z',
            ticket: r.ticket,
            kenh: r.kenh,
            phan_loai: r.phanLoai,
            noi_dung: r.noiDung,
            amount: 5000,
          }),
        );
    },
  };

  kpiRates = {
    todayRates: async () => this.rates,
  } as unknown as KpiRateStore;

  uow: UnitOfWork = {
    transaction: (fn) => fn({ kpiReports: this.kpiReports } as Repos),
  };
}

let fake: Fake;
let service: KpiReportService;

beforeEach(() => {
  fake = new Fake();
  service = new KpiReportService({ kpiReports: fake.kpiReports, kpiRates: fake.kpiRates, uow: fake.uow, now: () => NOW });
});

describe('submit', () => {
  it('dòng hợp lệ + dòng lỗi → kết quả giữ thứ tự, chỉ dòng hợp lệ được insert, createdAt theo now()', async () => {
    const out = await service.submit(S, [valid('row-0001'), valid('row-0002', { ticket: 'abc' }), valid('row-0003')]);
    expect(out.createdAt).toBe(NOW.toISOString());
    expect(out.results).toEqual([
      { rowId: 'row-0001', status: 'ok' },
      { rowId: 'row-0002', status: 'error', errors: [{ field: 'ticket', message: 'Ticket phải có dạng TICKET/số' }] },
      { rowId: 'row-0003', status: 'ok' },
    ]);
    expect(fake.inserted).toHaveLength(1);
    expect(fake.inserted[0]!.map((r) => r.rowId)).toEqual(['row-0001', 'row-0003']);
    expect(fake.inserted[0]![0]!.ticket).toBe('TICKET/123');
  });

  it('rác lẫn một dòng hợp lệ → 5 lỗi, 1 ok, không ném (Review Focus 4)', async () => {
    const junk = [5, null, [], {}, { rowId: 'abcdefgh', noiDung: 'x'.repeat(10000) }];
    const out = await service.submit(S, [...junk, valid('row-0001')]);
    expect(out.results.map((r) => r.status)).toEqual(['error', 'error', 'error', 'error', 'error', 'ok']);
    for (const r of out.results.slice(0, 5)) {
      expect(r.status === 'error' && r.errors.length > 0).toBe(true);
    }
    expect(out.results[4]).toMatchObject({ rowId: 'abcdefgh', status: 'error' });
    expect(out.results[4]!.status === 'error' && out.results[4]!.errors).toContainEqual({
      field: 'noiDung',
      message: 'Nội dung hỗ trợ tối đa 1000 ký tự',
    });
    expect(fake.inserted[0]!.map((r) => r.rowId)).toEqual(['row-0001']);
  });

  it('chỉ có dòng lỗi → không gọi insertMany', async () => {
    const out = await service.submit(S, [null]);
    expect(out.results).toEqual([{ rowId: '', status: 'error', errors: expect.any(Array) }]);
    expect(fake.inserted).toEqual([]);
  });

  it('trùng rowId trong payload → insertMany nhận một dòng, cả hai kết quả ok', async () => {
    const out = await service.submit(S, [valid('row-0001'), valid('row-0001', { noiDung: 'khác' })]);
    expect(out.results).toEqual([
      { rowId: 'row-0001', status: 'ok' },
      { rowId: 'row-0001', status: 'ok' },
    ]);
    expect(fake.inserted[0]).toHaveLength(1);
    expect(fake.inserted[0]![0]!.noiDung).toBe('Hỗ trợ cài đặt');
  });

  it('rowId sai dạng → lỗi, kể cả khi đã có trong DB', async () => {
    fake.db.set('ab', { rowId: 'ab', userId: 'S' } as NewKpiReport);
    const out = await service.submit(S, [valid('ab'), valid('có dấu!!')]);
    expect(out.results).toEqual([
      { rowId: 'ab', status: 'error', errors: [{ field: 'rowId', message: 'Mã dòng không hợp lệ' }] },
      { rowId: 'có dấu!!', status: 'error', errors: [{ field: 'rowId', message: 'Mã dòng không hợp lệ' }] },
    ]);
    expect(fake.inserted).toEqual([]);
  });

  it('row có team/name/email khác → insertMany nhận userId, fullName, teamId từ actor', async () => {
    await service.submit(S, [
      valid('row-0001', { team: 'Team B', teamId: 'khac', name: 'Giả', fullName: 'Giả', email: 'x@y.z', userId: 'H' }),
    ]);
    expect(fake.inserted[0]).toEqual([
      {
        rowId: 'row-0001',
        userId: 'S',
        fullName: 'Nhân Viên S',
        teamId: TEAM_A,
        ticket: 'TICKET/123',
        kenh: 'PI Hoàn Thành',
        phanLoai: 'Hỗ trợ sử dụng',
        noiDung: 'Hỗ trợ cài đặt',
      },
    ]);
  });

  it('Trưởng phòng gửi → teamId null, ok', async () => {
    const out = await service.submit(H, [valid('row-0001')]);
    expect(out.results).toEqual([{ rowId: 'row-0001', status: 'ok' }]);
    expect(fake.inserted[0]![0]).toMatchObject({ userId: 'H', teamId: null, fullName: 'Trưởng Phòng H' });
  });

  it('rowId đã thuộc người khác → ok, không tạo dòng cho người gửi, mine không thấy (Review Focus 3)', async () => {
    await service.submit(H, [valid('row-0001', { noiDung: 'của H' })]);
    const out = await service.submit(S, [valid('row-0001')]);
    expect(out.results).toEqual([{ rowId: 'row-0001', status: 'ok' }]);
    expect(fake.db.get('row-0001')).toMatchObject({ userId: 'H', noiDung: 'của H' });
    expect((await service.mine(S, RANGE)).items).toEqual([]);
    expect((await service.mine(H, RANGE)).items).toHaveLength(1);
  });
});

describe('mine', () => {
  it('11 kênh theo thứ tự KENH; distinctAmounts 2 → donGia null; kênh trống → giá hôm nay; tổng đúng', async () => {
    fake.summary = [
      { kenh: 'Chăm sóc KH', count: 3, total: 9000, distinctAmounts: 1, amount: 3000 },
      { kenh: 'PI Hoàn Thành', count: 2, total: 11000, distinctAmounts: 2, amount: 5000 },
    ];
    const out = await service.mine(S, RANGE);
    expect(out.lines.map((l) => l.kenh)).toEqual([...KENH]);
    expect(out.lines[0]).toEqual({ kenh: 'PI Hoàn Thành', soLuong: 2, donGia: null, thanhTien: 11000 });
    expect(out.lines[10]).toEqual({ kenh: 'Chăm sóc KH', soLuong: 3, donGia: 3000, thanhTien: 9000 });
    expect(out.lines[1]).toEqual({ kenh: 'PO Hoàn Thành', soLuong: 0, donGia: 2000, thanhTien: 0 });
    expect(out.tongSoLuong).toBe(5);
    expect(out.tongTien).toBe(20000);
    expect(out.byPhanLoai).toEqual({
      'Hỗ trợ sử dụng': 0,
      'Cấu hình phần mềm': 2,
      'Lỗi hệ thống, lỗi tích hợp': 0,
    });
    expect(out.byDay).toEqual([{ date: '2026-11-01', count: 2 }]);
  });

  it('gọi store với actor.id; items đổi sang camelCase', async () => {
    await service.submit(S, [valid('row-0001')]);
    const out = await service.mine(S, RANGE);
    expect(fake.calls.sort()).toEqual(['day:S', 'list:S', 'phanLoai:S', 'summary:S']);
    expect(out.items).toEqual([
      {
        createdAt: '2026-11-01T01:00:00.000Z',
        ticket: 'TICKET/123',
        kenh: 'PI Hoàn Thành',
        phanLoai: 'Hỗ trợ sử dụng',
        noiDung: 'Hỗ trợ cài đặt',
        amount: 5000,
      },
    ]);
  });
});
