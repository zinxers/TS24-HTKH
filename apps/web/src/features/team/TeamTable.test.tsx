import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../lib/api-client';
import { TEAMS, row, teamKpi, trend } from './fixtures.test-utils';
import { TeamTable } from './TeamTable';

const RANGE = { start: '2026-10-16', end: '2026-11-15' } as never;
let team: ReturnType<typeof vi.spyOn>;
let member: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.restoreAllMocks();
  team = vi.spyOn(apiClient.kpi, 'team');
  member = vi.spyOn(apiClient.kpi, 'member').mockResolvedValue({
    team: TEAMS[0]!,
    userId: 'u1',
    fullName: 'Lê Thị An',
    money: 12000,
    items: [{ createdAt: '2026-11-15T09:42:00.000Z', ticket: 'TICKET/88412', kenh: 'Chat Hoàn Thành', phanLoai: 'Hỗ trợ sử dụng', noiDung: 'Hướng dẫn kê khai', amount: 1000 }],
  });
  vi.spyOn(apiClient.kpi, 'trend').mockResolvedValue(trend('week', [1, 2]));
});

describe('TeamTable', () => {
  it('nhãn "Quản lý", "Không hoạt động", hàng Tổng, thẻ người có báo cáo', async () => {
    team.mockResolvedValue(
      teamKpi([
        row({}),
        row({ userId: 'u2', fullName: 'Trần Quốc Cường', role: 'manager' }),
        row({ userId: 'u3', fullName: 'Hoàng Lan', active: false }),
        row({ userId: 'u4', fullName: 'Ngô Gia Khánh', total: 0, money: 0, days: 0 }),
      ]),
    );
    render(<TeamTable teamId="t1" range={RANGE} />);
    const table = await screen.findByRole('table', { name: 'Thành viên' });
    expect(team).toHaveBeenCalledWith('t1', { from: '2026-10-16', to: '2026-11-15' });
    expect(within(table).getByRole('row', { name: /Trần Quốc Cường/ })).toHaveTextContent('Quản lý');
    const off = within(table).getByRole('row', { name: /Hoàng Lan/ });
    expect(off).toHaveTextContent('Không hoạt động');
    expect(off).toHaveClass('off');
    expect(within(table).getByRole('row', { name: /Lê Thị An/ })).not.toHaveTextContent('Quản lý');
    const foot = within(table).getByRole('row', { name: /^Tổng/ });
    expect(foot).toHaveTextContent('33');
    expect(foot).toHaveTextContent('36.000');
    expect(screen.getByText('3 / 4')).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'PI / PO' })).toBeInTheDocument();
  });

  it('team rỗng hiện "Chưa có dữ liệu"', async () => {
    team.mockResolvedValue(teamKpi([]));
    render(<TeamTable teamId="t1" range={RANGE} />);
    expect(await screen.findByText('Chưa có dữ liệu')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Thành viên' })).not.toBeInTheDocument();
  });

  it('bấm tên gọi kpi.member và mở chi tiết; Đóng thì ẩn', async () => {
    team.mockResolvedValue(teamKpi([row({})]));
    render(<TeamTable teamId="t1" range={RANGE} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Lê Thị An' }));
    await waitFor(() => expect(member).toHaveBeenCalledWith('t1', 'u1', { from: '2026-10-16', to: '2026-11-15' }));
    const panel = await screen.findByRole('region', { name: 'Chi tiết thành viên' });
    expect(within(panel).getByText('TICKET/88412')).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByRole('region', { name: 'Chi tiết thành viên' })).not.toBeInTheDocument();
  });
});
