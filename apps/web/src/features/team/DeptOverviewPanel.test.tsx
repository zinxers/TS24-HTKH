import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../lib/api-client';
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
    expect(within(byTeam).getByRole('row', { name: /Cả phòng/ })).toHaveTextContent('4 / 8');
    expect(screen.getByText('so với 16/09/2026 – 15/10/2026')).toBeInTheDocument();
    expect(within(byTeam).getByRole('row', { name: /Thuế, Kế toán và Hệ thống quản lý/ })).toHaveTextContent('+20%');
    expect(within(byTeam).getByRole('row', { name: /Bảo hiểm xã hội/ })).toHaveTextContent('−6%');
    expect(within(byTeam).getByRole('row', { name: /Không thuộc team/ })).toHaveClass('off');
    const groups = screen.getByRole('table', { name: 'Nhóm kênh × team' });
    expect(within(groups).getByRole('columnheader', { name: 'iBHXH' })).toBeInTheDocument();
    expect(within(groups).getByRole('row', { name: /PI \/ PO/ })).toHaveTextContent('13');
  });
});
