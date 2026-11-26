import type { Reconcile } from '@ts24-htkh/shared';
import { RECONCILE_KENH } from '@ts24-htkh/shared';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../lib/api-client';
import { ReconcilePanel } from './ReconcilePanel';

const counts = (n: number) => Object.fromEntries(RECONCILE_KENH.map((k) => [k, n])) as Reconcile['totals']['counts'];
const base: Reconcile = {
  range: { from: '2026-10-16', to: '2026-11-15' } as never,
  title: 'HTKH - ĐỐI SOÁT KPI',
  fileName: 'HTKH - Đối soát KPI 16.10.2026-15.11.2026.xlsx',
  kenh: RECONCILE_KENH,
  rates: RECONCILE_KENH.map(() => 1000),
  teams: [
    {
      teamId: 't1',
      label: 'TEAM 1 (Thuế)',
      rows: [
        { userId: 'm', name: 'Quản Lý Một', manager: true, counts: counts(0), total: 0, money: 0 },
        { userId: 'u', name: 'Nhân Viên A', manager: false, counts: counts(0), total: 0, money: 0 },
      ],
    },
  ],
  totals: { counts: counts(2), total: 1234, money: 5678000 },
  rateChanged: true,
  flags: [
    {
      rule: 2,
      people: [{ userId: 'u', name: 'Nhân Viên A', team: 'TEAM 1' }],
      text: '22 dòng kênh giá cao',
      count: 22,
      money: 98000,
      items: [{ at: '2026-11-03T17:30:00.000Z', ticket: 'TICKET/1', kenh: 'Chăm sóc KH', name: 'Hỗ trợ' }],
      more: 5,
    },
  ],
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-25T03:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('ReconcilePanel', () => {
  it('hiện dòng Quản lý, TỔNG và cảnh báo đơn giá', async () => {
    const rec = vi.spyOn(apiClient.reports, 'reconcile').mockResolvedValue(base);
    render(<ReconcilePanel onUnauthorized={vi.fn()} />);
    const table = await screen.findByRole('table', { name: 'Đối soát KPI theo nhân viên' });
    expect(rec).toHaveBeenCalledWith({ from: '2026-10-16', to: '2026-11-15' });
    expect(within(table).getByText('Quản lý, không tính KPI')).toBeInTheDocument();
    expect(within(table).getByText('TỔNG')).toBeInTheDocument();
    expect(screen.getByText('Đơn giá đổi trong khoảng này.')).toBeInTheDocument();
    expect(screen.getByText('Cần xem lại')).toBeInTheDocument();
    expect(screen.getByText('QT2 · Lô lớn kênh giá cao')).toBeInTheDocument();
    expect(screen.getByText('và 5 dòng nữa')).toBeInTheDocument();
    expect(screen.getByText(/^00:30 04\/11\/2026 · TICKET\/1/)).toBeInTheDocument();
  });

  it('không có cờ hiện câu Không có trường hợp…', async () => {
    vi.spyOn(apiClient.reports, 'reconcile').mockResolvedValue({ ...base, flags: [], rateChanged: false });
    render(<ReconcilePanel onUnauthorized={vi.fn()} />);
    expect(await screen.findByText('Không có trường hợp cần xem lại trong khoảng này')).toBeInTheDocument();
    expect(screen.queryByText('Đơn giá đổi trong khoảng này.')).not.toBeInTheDocument();
  });

  it('đổi kỳ gọi lại API với from/to mới', async () => {
    const rec = vi.spyOn(apiClient.reports, 'reconcile').mockResolvedValue(base);
    render(<ReconcilePanel onUnauthorized={vi.fn()} />);
    await screen.findByRole('table');
    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-11-10' } });
    await waitFor(() => expect(rec).toHaveBeenLastCalledWith({ from: '2026-10-16', to: '2026-11-10' }));
  });

  it('đổi kỳ: không hiện bảng kỳ cũ cho tới khi có dữ liệu mới', async () => {
    const rec = vi.spyOn(apiClient.reports, 'reconcile').mockResolvedValueOnce(base);
    render(<ReconcilePanel onUnauthorized={vi.fn()} />);
    await screen.findByRole('table');
    rec.mockReturnValueOnce(new Promise(() => {}));
    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-11-10' } });
    await waitFor(() => expect(screen.queryByRole('table')).not.toBeInTheDocument());
    expect(screen.queryByText('Tải file xlsx')).not.toBeInTheDocument();
  });

  it('bấm Tải file gọi reconcileFile', async () => {
    vi.spyOn(apiClient.reports, 'reconcile').mockResolvedValue(base);
    const file = vi.spyOn(apiClient.reports, 'reconcileFile').mockResolvedValue({ blob: new Blob(['x']), fileName: base.fileName });
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<ReconcilePanel onUnauthorized={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Tải file xlsx' }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(file).toHaveBeenCalledWith({ from: '2026-10-16', to: '2026-11-15' });
  });

  it('lỗi API hiện role=alert', async () => {
    vi.spyOn(apiClient.reports, 'reconcile').mockRejectedValue(new Error('x'));
    render(<ReconcilePanel onUnauthorized={vi.fn()} />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
