import type { CurrentUser, Kenh, RateVersion } from '@ts24-htkh/shared';
import { DEFAULT_KPI_RATES, KENH } from '@ts24-htkh/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient } from '../../lib/api-client';
import { renderWithUser } from '../../test/render-with-user';
import { RatesPanel } from './RatesPanel';


const user = (role: CurrentUser['role']): CurrentUser => ({ id: 'u', email: 'a@example.com', fullName: 'Người Dùng', role, teamId: null });
const V0: RateVersion = { from: '2000-01-01' as never, rates: DEFAULT_KPI_RATES, createdBy: null, createdAt: '2026-11-01T00:00:00Z' };
const V1: RateVersion = {
  from: '2026-11-01' as never,
  rates: { ...DEFAULT_KPI_RATES, 'Email Hoàn Thành': 1800 } as Record<Kenh, number>,
  createdBy: 'h',
  createdAt: '2026-10-30T00:00:00Z',
};

function setup(role: CurrentUser['role']) {
  vi.spyOn(apiClient.kpi, 'rates').mockResolvedValue([V0, V1]);
  return renderWithUser(<RatesPanel />, user(role));
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('RatesPanel', () => {
  it('mọi người xem được lịch sử theo cột phiên bản, mới nhất trước', async () => {
    setup('staff');
    const table = await screen.findByRole('table', { name: 'Lịch sử đơn giá' });
    const heads = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(heads[1]).toContain('01/11/2026');
    expect(heads[1]).toContain('Hiện hành');
    expect(heads[2]).toContain('Mặc định');
    expect(within(table).getByText('1.800')).toBeInTheDocument();
  });

  it('nhãn cột: "Mặc định" chỉ cho bản 2000-01-01; bản khác createdBy null hiện ngày; không cảnh báo key', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const seeded: RateVersion = { ...V1, from: '2026-11-09' as never, createdBy: null };
    vi.spyOn(apiClient.kpi, 'rates').mockResolvedValue([V0, seeded]);
    renderWithUser(<RatesPanel />, user('staff'));
    const table = await screen.findByRole('table', { name: 'Lịch sử đơn giá' });
    const heads = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(heads[1]).toContain('Từ 09/11/2026');
    expect(heads[1]).toContain('Hiện hành');
    expect(heads[2]).toBe('Mặc định');
    expect(err.mock.calls.filter((c) => String(c[0]).includes('same key'))).toEqual([]);
  });

  it.each([
    ['head', true],
    ['manager', false],
    ['staff', false],
  ] as const)('%s: nút Đổi đơn giá hiện = %s', async (role, shown) => {
    setup(role);
    await screen.findByRole('table');
    expect(!!screen.queryByRole('button', { name: 'Đổi đơn giá' })).toBe(shown);
  });

  it('lưu qua ConfirmDialog: form -> "Lưu đơn giá mới?" -> setRates đủ 11 kênh', async () => {
    setup('head');
    const set = vi.spyOn(apiClient.kpi, 'setRates').mockResolvedValue([V0, V1]);
    fireEvent.click(await screen.findByRole('button', { name: 'Đổi đơn giá' }));
    const form = screen.getByRole('dialog');
    fireEvent.change(within(form).getByLabelText('Ngày áp dụng'), { target: { value: '2026-12-01' } });
    fireEvent.change(within(form).getByLabelText('Chăm sóc KH'), { target: { value: '6.000' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu' }));
    expect(set).not.toHaveBeenCalled();
    const confirm = screen.getAllByRole('dialog').at(-1)!;
    expect(within(confirm).getByRole('heading', { name: 'Lưu đơn giá mới?' })).toBeInTheDocument();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(set).toHaveBeenCalledTimes(1));
    const arg = set.mock.calls[0]![0];
    expect(arg.from).toBe('2026-12-01');
    expect(Object.keys(arg.rates)).toEqual([...KENH]);
    expect(arg.rates['Chăm sóc KH']).toBe(6000);
    expect(arg.rates['Email Hoàn Thành']).toBe(1800);
  });

  it.each([
    [400, 'Ngày áp dụng phải từ hôm nay trở đi'],
    [403, 'Chỉ Trưởng phòng được đổi đơn giá'],
  ])('lỗi %i hiện message từ API trong form', async (status, message) => {
    setup('head');
    vi.spyOn(apiClient.kpi, 'setRates').mockRejectedValue(new ApiError('X', status, message));
    fireEvent.click(await screen.findByRole('button', { name: 'Đổi đơn giá' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Lưu' }));
    fireEvent.click(within(screen.getAllByRole('dialog').at(-1)!).getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText(message)).toBeInTheDocument();
  });
});
