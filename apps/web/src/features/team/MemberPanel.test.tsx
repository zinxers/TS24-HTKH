import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient } from '../../lib/api-client';
import { TEAMS } from './fixtures.test-utils';
import { MemberPanel } from './MemberPanel';

const RANGE = { start: '2026-10-16', end: '2026-11-15' } as never;

beforeEach(() => vi.restoreAllMocks());

describe('MemberPanel', () => {
  it('tiêu đề tên · ticket · tiền; thời điểm theo giờ VN', async () => {
    vi.spyOn(apiClient.kpi, 'member').mockResolvedValue({
      team: TEAMS[0]!,
      userId: 'u1',
      fullName: 'Lê Thị An',
      money: 331500,
      items: [{ createdAt: '2026-11-15T16:30:00.000Z', ticket: 'TICKET/1', kenh: 'PI Hoàn Thành', phanLoai: 'Hỗ trợ sử dụng', noiDung: 'X', amount: 1 }],
    });
    render(<MemberPanel teamId="t1" userId="u1" range={RANGE} onClose={() => undefined} />);
    const panel = await screen.findByRole('region', { name: 'Chi tiết thành viên' });
    expect(await within(panel).findByRole('heading', { name: 'Lê Thị An · 1 ticket · 331.500 đ' })).toBeInTheDocument();
    // 16:30Z = 23:30 ngày 15 giờ VN.
    expect(within(panel).getByText('15/11/2026 23:30')).toBeInTheDocument();
  });

  it('lỗi 404 hiện message', async () => {
    vi.spyOn(apiClient.kpi, 'member').mockRejectedValue(new ApiError('NOT_FOUND', 404, 'Không tìm thấy thành viên'));
    render(<MemberPanel teamId="t1" userId="x" range={RANGE} onClose={() => undefined} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tìm thấy thành viên');
  });
});
