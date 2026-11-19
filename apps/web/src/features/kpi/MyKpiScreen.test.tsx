import type { CurrentUser, Kenh, MyKpi } from '@ts24-htkh/shared';
import { KENH, KENH_GROUPS, runningMonthPeriod } from '@ts24-htkh/shared';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient } from '../../lib/api-client';
import { MyKpiScreen } from './MyKpiScreen';

const replace = vi.fn();
const router = { replace: (...args: unknown[]) => replace(...args) };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const USER: CurrentUser = { id: 'u1', email: 'a@example.com', fullName: 'Nhân Viên A', role: 'staff', teamId: 't1' };
const TODAY = '2026-11-19';

const kpi = (): MyKpi => ({
  lines: KENH.map((kenh: Kenh) => ({
    kenh,
    soLuong: kenh === 'Email Hoàn Thành' ? 12 : 1,
    donGia: kenh === 'Email Hoàn Thành' ? null : 1000,
    thanhTien: kenh === 'Email Hoàn Thành' ? 19200 : 1000,
  })),
  tongSoLuong: 22,
  tongTien: 29200,
  byPhanLoai: { 'Hỗ trợ sử dụng': 22, 'Cấu hình phần mềm': 0, 'Lỗi hệ thống, lỗi tích hợp': 0 },
  byDay: [],
  items: [
    { createdAt: '2026-11-15T16:30:00.000Z', ticket: 'TICKET/48102', kenh: 'Email Hoàn Thành', phanLoai: 'Hỗ trợ sử dụng', noiDung: 'In lại hóa đơn', amount: 1800 },
  ],
});

let mine: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.restoreAllMocks();
  replace.mockReset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-19T05:00:00Z'));
  vi.spyOn(apiClient.auth, 'me').mockResolvedValue(USER);
  vi.spyOn(apiClient.teams, 'list').mockResolvedValue([{ id: 't1', name: 'Team Hỗ trợ 1A' }]);
  mine = vi.spyOn(apiClient.kpi, 'mine').mockResolvedValue(kpi());
});
afterEach(() => vi.useRealTimers());

describe('MyKpiScreen', () => {
  it('chọn "Tháng này" gọi mine với runningMonthPeriod(hôm nay VN)', async () => {
    const p = runningMonthPeriod(TODAY as never);
    render(<MyKpiScreen />);
    await screen.findByText('Team Hỗ trợ 1A');
    fireEvent.click(screen.getByRole('button', { name: 'Tuần trước' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tuần trước' })).toHaveAttribute('aria-pressed', 'true'));
    fireEvent.click(screen.getByRole('button', { name: 'Tháng này' }));
    await waitFor(() => expect(mine).toHaveBeenLastCalledWith({ from: p.start, to: p.end }));
    expect(screen.getByRole('button', { name: 'Tháng này' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('nhập tay ngày thì chip bỏ chọn', async () => {
    render(<MyKpiScreen />);
    await screen.findByText('Team Hỗ trợ 1A');
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-10-01' } });
    await waitFor(() => expect(mine).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2026-10-01' })));
    expect(screen.getByRole('button', { name: 'Tháng này' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('bảng 6 nhóm / 11 kênh; donGia null hiện "Nhiều mức"; ô tổng; ngày theo giờ VN', async () => {
    render(<MyKpiScreen />);
    const table = await screen.findByRole('table', { name: 'Tổng hợp theo kênh' });
    for (const g of KENH_GROUPS) expect(within(table).getByRole('rowheader', { name: g.name })).toBeInTheDocument();
    for (const k of KENH) expect(within(table).getByRole('cell', { name: k })).toBeInTheDocument();
    expect(within(table).getAllByText('Nhiều mức')).toHaveLength(1);
    expect(screen.getByText('29.200 đ')).toBeInTheDocument();
    expect(screen.getByText('Tổng số lượng')).toBeInTheDocument();
    expect(screen.getByText('TICKET/48102')).toBeInTheDocument();
    // 16:30Z = 23:30 giờ VN, vẫn là ngày 15.
    expect(screen.getByText('15/11/2026')).toBeInTheDocument();
  });

  it('không có cảnh báo key trùng trong console', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<MyKpiScreen />);
    await screen.findByRole('table', { name: 'Tổng hợp theo kênh' });
    expect(err.mock.calls.filter((c) => String(c[0]).includes('same key'))).toEqual([]);
  });

  it('lỗi từ API hiện message', async () => {
    mine.mockRejectedValue(new ApiError('VALIDATION', 400, 'Khoảng ngày tối đa 400 ngày'));
    render(<MyKpiScreen />);
    expect(await screen.findByText('Khoảng ngày tối đa 400 ngày')).toBeInTheDocument();
  });
});
