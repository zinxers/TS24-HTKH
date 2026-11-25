// Chuyển từ HTKH-KPI/app/tests/report.test.js (các ca reportCells, periodicCounts, ghi chú).
import { isoDate, type Role } from '@ts24-htkh/shared';
import { describe, expect, it } from 'vitest';
import { reportCells, teamCounts, type TeamCounts } from './report-cells';

const [T1, T2, T3] = ['t1', 't2', 't3'];
const IDS = [T1, T2, T3];
const t: TeamCounts = { total: 10, tongDai: 5, chat: 2, email: 1, loi: 1, cauHinh: 2, hoTro: 7, people: 2 };
const zero: TeamCounts = { total: 0, tongDai: 0, chat: 0, email: 0, loi: 0, cauHinh: 0, hoTro: 0, people: 0 };

const o = (extra: Partial<Parameters<typeof reportCells>[2]> = {}): Parameters<typeof reportCells>[2] => ({
  label: 'Tuần 43 tháng 10/2026',
  sentDay: isoDate('2026-11-23'),
  role: 'head' as Role,
  prevTotal: 0,
  running: false,
  notes: {},
  teamIds: IDS,
  ...extra,
});

describe('teamCounts', () => {
  it('Tổng đài = PI + PO, Chat, Email; phân loại; people = số người khác nhau', () => {
    const c = teamCounts([
      { userId: 'a', kenh: 'PI Hoàn Thành', phanLoai: 'Hỗ trợ sử dụng', count: 2 },
      { userId: 'a', kenh: 'PO Nhận thông tin', phanLoai: 'Lỗi hệ thống, lỗi tích hợp', count: 1 },
      { userId: 'b', kenh: 'Chat Hoàn Thành', phanLoai: 'Cấu hình phần mềm', count: 2 },
      { userId: 'b', kenh: 'Email Nhận thông tin', phanLoai: 'Hỗ trợ sử dụng', count: 1 },
      { userId: 'b', kenh: 'Teamviewer Hoàn Thành', phanLoai: 'Hỗ trợ sử dụng', count: 3 },
    ]);
    expect(c).toEqual({ total: 9, tongDai: 3, chat: 2, email: 1, loi: 1, cauHinh: 2, hoTro: 6, people: 2 });
  });

  it('không có dòng → 0', () => {
    expect(teamCounts([])).toEqual(zero);
  });
});

describe('reportCells WR', () => {
  it('3 team: cột C-E, Hoàn thành = Tổng đài + Chat + Email, nhãn, ngày gửi, ký TP', () => {
    const c = reportCells('WR', [t, t, t], o());
    expect(c.B10).toBe(30);
    expect(c.C27).toBe(5);
    expect(c.D28).toBe(2);
    expect(c.E29).toBe(1);
    expect(c.C30).toBe(8);
    expect(c.D30).toBe(8);
    expect(c.C33).toBe(1);
    expect(c.C34).toBe(2);
    expect(c.E35).toBe(7);
    expect('C31' in c || 'C32' in c).toBe(false);
    expect(c.A6).toBe('Tuần 43 tháng 10/2026');
    expect(c.B5).toBe('Ngày gửi: 23/11/2026');
    expect(c.D60).toBe('TP. Hỗ Trợ Khách Hàng');
  });

  it('B10 = max(tổng tiếp nhận, tổng phân loại)', () => {
    const more = { ...t, tongDai: 6, chat: 1, email: 1, loi: 1, cauHinh: 1, hoTro: 1 };
    const less = { ...t, tongDai: 1, chat: 0, email: 0, loi: 2, cauHinh: 2, hoTro: 2 };
    expect(reportCells('WR', [more, more, more], o()).B10).toBe(24);
    expect(reportCells('WR', [less, less, less], o()).B10).toBe(18);
    expect(reportCells('WR', [more, less, null], o()).B10).toBe(9);
    expect(reportCells('WR', [more, null, null], o({ role: 'manager' })).B10).toBe(8);
  });

  it('Quản lý team giữa: chỉ cột D có số, ký PP', () => {
    const c = reportCells('WR', [null, t, null], o({ role: 'manager' }));
    expect(c.D27).toBe(5);
    expect(c.D30).toBe(8);
    expect('C27' in c || 'E27' in c || 'C30' in c || 'E30' in c).toBe(false);
    expect(c.D60).toBe('PP. Hỗ Trợ Khách Hàng');
  });

  it('kỳ không có KPI ghi 0', () => {
    const c = reportCells('WR', [zero, zero, zero], o());
    expect(c.B10).toBe(0);
    expect(c.C27).toBe(0);
    expect(c.C30).toBe(0);
  });
});

describe('reportCells MR', () => {
  it('B9 = B23 = tổng; mũi tên so với tháng trước; xóa mũi tên mẫu C24-C28', () => {
    const m = reportCells('MR', [t, t, t], o({ prevTotal: 20 }));
    expect(m.B9).toBe(30);
    expect(m.B23).toBe(30);
    expect(m.C23).toBe('↑');
    for (const ref of ['C24', 'C25', 'C26', 'C27', 'C28']) expect(m[ref]).toBeNull();
    expect(reportCells('MR', [t, t, t], o({ prevTotal: 40 })).C23).toBe('↓');
    expect(reportCells('MR', [t, t, t], o({ prevTotal: 30 })).C23).toBe('=');
    expect(reportCells('MR', [zero, zero, zero], o({ prevTotal: 0 })).C23).toBe('=');
    expect(reportCells('MR', [null, t, null], o({ role: 'manager', prevTotal: 1 })).D55).toBe('PP. Hỗ Trợ Khách Hàng');
  });

  it('kỳ đang chạy: không mũi tên', () => {
    const m = reportCells('MR', [t, t, t], o({ prevTotal: 500, running: true }));
    expect(m.C23).toBeNull();
    expect(m.B9).toBe(30);
  });

  it('MR không có ô của WR', () => {
    const m = reportCells('MR', [t, t, t], o({ notes: { dept: { sla: 'x' }, [T1]: { slaTeam: 'y' } } }));
    expect('B12' in m || 'C41' in m || 'C30' in m || 'B10' in m).toBe(false);
  });
});

describe('reportCells QR', () => {
  it('tổng và ticket / nhân sự làm tròn 1 chữ số', () => {
    const r = reportCells('QR', [t, { ...t, people: 3 }, { ...t, total: 1000, people: 3 }], o());
    expect(r.B9).toBe(1020);
    expect(r.C34).toBe(5);
    expect(r.D34).toBe(3.3);
    expect(r.E34).toBe(333.3);
    expect(r.D55).toBe('TP. Hỗ Trợ Khách Hàng');
  });

  it('people = 0: không ghi dòng 34 của cột đó', () => {
    const r = reportCells('QR', [zero, t, zero], o());
    expect(r.B9).toBe(10);
    expect('C34' in r || 'E34' in r).toBe(false);
    expect(r.D34).toBe(5);
  });
});

describe('reportCells chữ', () => {
  const notes: Record<string, Record<string, string>> = {
    dept: { sla: '100%', mttr: '0.2h', backlog: '', vanDe: 'Cả phòng ổn', ceo: 'Không' },
    [T1]: { sla: '99%', slaTeam: 'Đạt 100%', mttrTeam: '0.17 giờ', repeat: '15%', vanDeTeam: '- Lỗi A\n- Lỗi B', keHoach: 'Kế hoạch 1' },
    [T2]: { sla: '98%', slaTeam: 'Đạt T2', vanDeTeam: 'Vấn đề T2', keHoach: 'Kế hoạch 2', repeat: '   ' },
    [T3]: { keHoach: 'Kế hoạch 3' },
  };

  it('Trưởng phòng: mục I từ Cả phòng, mục khác từ 3 team; stacked ghi C{row+i}; chữ rỗng không có key', () => {
    const c = reportCells('WR', [t, t, t], o({ notes }));
    expect(c.B12).toBe('100%');
    expect(c.B14).toBe('0.2h');
    expect('B16' in c).toBe(false);
    expect(c.B18).toBe('Cả phòng ổn');
    expect(c.B20).toBe('Không');
    expect(c.C41).toBe('Đạt 100%');
    expect(c.D41).toBe('Đạt T2');
    expect(c.C42).toBe('0.17 giờ');
    expect(c.C43).toBe('15%');
    expect('D43' in c).toBe(false);
    expect(c.C49).toBe('- Lỗi A\n- Lỗi B');
    expect(c.C50).toBe('Vấn đề T2');
    expect(c.C55).toBe('Kế hoạch 1');
    expect(c.C56).toBe('Kế hoạch 2');
    expect(c.C57).toBe('Kế hoạch 3');
    expect('E41' in c || 'C51' in c).toBe(false);
  });

  it('Quản lý team giữa: tóm tắt từ team mình dù có Cả phòng; chỉ chữ team mình', () => {
    const c = reportCells('WR', [null, t, null], o({ role: 'manager', notes }));
    expect(c.B12).toBe('98%');
    expect(c.D41).toBe('Đạt T2');
    expect(c.C50).toBe('Vấn đề T2');
    expect(c.C56).toBe('Kế hoạch 2');
    expect('C41' in c || 'C49' in c || 'C55' in c || 'C57' in c || 'B18' in c).toBe(false);
  });

  it('MR: mục I, II từ Cả phòng ghi đè ô mũi tên; team theo cột; mục V stacked', () => {
    const mrNotes: Record<string, Record<string, string>> = {
      dept: { mrSla: 'P 99%', mrXuHuong: 'P tăng', mrKpiSla: 'K 99%', mrSoSla: '↑', mrSoCsat: '↓' },
      [T1]: { mrSla: 'T1 không vào file', mrHeThong: 'a', mrDeXuat: 'g' },
      [T3]: { mrHeThong: 'x3', mrNhayCam: 'y3', mrDeXuat: 'z3' },
    };
    const m = reportCells('MR', [t, t, t], o({ prevTotal: 1, notes: mrNotes }));
    expect(m).toMatchObject({ B11: 'P 99%', C17: 'P tăng', B24: 'K 99%', C24: '↑', C28: '↓', C34: 'a', C48: 'g', E34: 'x3', E44: 'y3', C50: 'z3' });
    expect(m.C25).toBeNull();
    expect('D34' in m || 'C49' in m).toBe(false);
    expect(m.C23).toBe('↑');
  });

  it('QR: dòng 34 vẫn là số tính được', () => {
    const r = reportCells('QR', [t, t, t], o({ notes: { dept: { qrXuHuong: 'xu hướng' }, [T2]: { qrLoiTang: 'l', qrDeXuat: 'd' } } }));
    expect(r.B17).toBe('xu hướng');
    expect(r.D25).toBe('l');
    expect(r.C49).toBe('d');
    expect(r.D34).toBe(5);
  });
});
