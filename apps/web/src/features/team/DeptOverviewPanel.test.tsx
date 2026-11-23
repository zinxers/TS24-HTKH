import type { DeptOverview } from '@ts24-htkh/shared';
import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient } from '../../lib/api-client';
import { overview, trend } from './fixtures.test-utils';
import { DeptOverviewPanel } from './DeptOverviewPanel';

const RANGE = { start: '2026-10-16', end: '2026-11-15' } as never;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(apiClient.kpi, 'overview').mockResolvedValue(overview());
  vi.spyOn(apiClient.kpi, 'trend').mockResolvedValue(trend('month', [1, 2, 3, 4, 5, 6]));
});

describe('DeptOverviewPanel', () => {
  it('thẻ tổng, bảng Theo team có % và hàng Không thuộc team, bảng nhóm kênh theo shortName', async () => {
    render(<DeptOverviewPanel range={RANGE} />);
    const byTeam = await screen.findByRole('table', { name: 'Theo team' });
    expect(screen.getByText('Người có báo cáo').previousSibling).toHaveTextContent('4 / 8');
    const dept = within(byTeam).getByRole('row', { name: /Cả phòng/ });
    expect(dept).toHaveTextContent('4 / 8');
    // Kỳ trước và % lấy nguyên từ totals của API (số cố ý không khớp tổng client).
    expect(dept).toHaveTextContent('99');
    expect(dept).toHaveTextContent('+7%');
    expect(screen.getByText('so với 16/09/2026 – 15/10/2026')).toBeInTheDocument();
    expect(within(byTeam).getByRole('row', { name: /Thuế, Kế toán và Hệ thống quản lý/ })).toHaveTextContent('+20%');
    expect(within(byTeam).getByRole('row', { name: /Bảo hiểm xã hội/ })).toHaveTextContent('−6%');
    expect(within(byTeam).getByRole('row', { name: /Không thuộc team/ })).toHaveClass('off');
    const groups = screen.getByRole('table', { name: 'Nhóm kênh × team' });
    expect(within(groups).getByRole('columnheader', { name: 'iBHXH' })).toBeInTheDocument();
    expect(within(groups).getByRole('row', { name: /PI \/ PO/ })).toHaveTextContent('13');
  });

  it('đang tải hiện "Đang tải…", lỗi API hiện thông báo', async () => {
    vi.mocked(apiClient.kpi.overview).mockRejectedValue(new ApiError('FORBIDDEN', 403, 'Chỉ Trưởng phòng được xem tổng quan phòng'));
    render(<DeptOverviewPanel range={RANGE} />);
    expect(screen.getByText('Đang tải…')).toHaveAttribute('aria-busy', 'true');
    expect(await screen.findByRole('alert')).toHaveTextContent('Chỉ Trưởng phòng được xem tổng quan phòng');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('đổi kỳ nhanh: giữ số cũ kèm "Đang tải…", kết quả kỳ cũ về muộn không ghi đè kỳ mới', async () => {
    const slow = deferred<DeptOverview>();
    const fast = deferred<DeptOverview>();
    vi.mocked(apiClient.kpi.overview).mockResolvedValueOnce(overview()).mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);
    const { rerender } = render(<DeptOverviewPanel range={RANGE} />);
    await screen.findByRole('table', { name: 'Theo team' });

    rerender(<DeptOverviewPanel range={{ start: '2026-09-16', end: '2026-10-15' } as never} />);
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải…');
    expect(screen.getByRole('table', { name: 'Theo team' })).toBeInTheDocument();

    rerender(<DeptOverviewPanel range={{ start: '2026-08-16', end: '2026-09-15' } as never} />);
    fast.resolve({ ...overview(), totals: { ...overview().totals, total: 555 } });
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    slow.resolve({ ...overview(), totals: { ...overview().totals, total: 111 } });
    await slow.promise;
    expect(screen.getByText('Ticket cả phòng').previousSibling).toHaveTextContent('555');
  });
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
