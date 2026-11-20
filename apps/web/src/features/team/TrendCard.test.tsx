import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../lib/api-client';
import { trend } from './fixtures.test-utils';
import { TrendCard } from './TrendCard';

let spy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.restoreAllMocks();
  spy = vi.spyOn(apiClient.kpi, 'trend').mockImplementation(async (_t: string, unit: 'week' | 'month') =>
    unit === 'week' ? trend('week', [10, 5]) : trend('month', [0, 0, 0, 0, 4, 8]),
  );
});

describe('TrendCard', () => {
  it('12 tuần: nhãn T<tuần TS24>, kỳ đang chạy mờ, title có ticket và tiền', async () => {
    render(<TrendCard team="t1" title="Xu hướng" />);
    const chart = await screen.findByRole('list', { name: 'Ticket 12 tuần TS24 gần nhất' });
    const cols = within(chart).getAllByRole('listitem');
    expect(cols.map((c) => c.textContent)).toEqual(['T35', 'T36']);
    expect(cols[1]).toHaveClass('running');
    expect(cols[0]).not.toHaveClass('running');
    expect(cols[0]).toHaveAttribute('title', 'T35: 10 ticket · 10.000 đ');
    expect(spy).toHaveBeenCalledWith('t1', 'week');
  });

  it('6 tháng: nhãn T<tháng>; đổi đơn vị gọi lại API', async () => {
    render(<TrendCard team="all" title="Xu hướng cả phòng" />);
    await screen.findByRole('list', { name: 'Ticket 12 tuần TS24 gần nhất' });
    fireEvent.click(screen.getByRole('button', { name: '6 tháng' }));
    const chart = await screen.findByRole('list', { name: 'Ticket 6 tháng TS24 gần nhất' });
    await waitFor(() => expect(within(chart).getAllByRole('listitem').map((c) => c.textContent)).toEqual(['T6', 'T7', 'T8', 'T9', 'T10', 'T11']));
    expect(spy).toHaveBeenLastCalledWith('all', 'month');
  });

  it('không có ticket nào hiện "Chưa có dữ liệu"', async () => {
    spy.mockResolvedValue(trend('week', [0, 0]));
    render(<TrendCard team="t1" title="Xu hướng" />);
    expect(await screen.findByText('Chưa có dữ liệu')).toBeInTheDocument();
  });
});
