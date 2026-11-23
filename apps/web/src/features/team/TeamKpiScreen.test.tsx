import type { CurrentUser } from '@ts24-htkh/shared';
import { runningMonthPeriod } from '@ts24-htkh/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient } from '../../lib/api-client';
import { TEAMS, overview, row, teamKpi, trend } from './fixtures.test-utils';
import { TeamKpiScreen } from './TeamKpiScreen';

const router = { replace: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const MANAGER: CurrentUser = { id: 'm2', email: 'quan.ly.2@example.com', fullName: 'Quản Lý Hai', role: 'manager', teamId: 't2' };
const HEAD: CurrentUser = { id: 'h', email: 'truong.phong@example.com', fullName: 'Trưởng Phòng', role: 'head', teamId: null };

let team: ReturnType<typeof vi.spyOn>;
let ov: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-19T05:00:00Z'));
  vi.spyOn(apiClient.teams, 'list').mockResolvedValue(TEAMS);
  team = vi.spyOn(apiClient.kpi, 'team').mockImplementation(async (id: string) => teamKpi([row({})], TEAMS.find((t) => t.id === id)));
  ov = vi.spyOn(apiClient.kpi, 'overview').mockResolvedValue(overview());
  vi.spyOn(apiClient.kpi, 'trend').mockImplementation(async (_t: string, unit: 'week' | 'month') => trend(unit, [1, 2]));
});
afterEach(() => vi.useRealTimers());

describe('TeamKpiScreen', () => {
  it('Quản lý: không có hàng tab, gọi kpi.team(team mình, kỳ tháng đang chạy)', async () => {
    vi.spyOn(apiClient.auth, 'me').mockResolvedValue(MANAGER);
    const p = runningMonthPeriod('2026-11-19' as never);
    render(<TeamKpiScreen />);
    await waitFor(() => expect(team).toHaveBeenCalledWith('t2', { from: p.start, to: p.end }));
    expect(await screen.findByRole('table', { name: 'Thành viên' })).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(ov).not.toHaveBeenCalled();
  });

  it('Trưởng phòng: 3 tab theo shortName (title = tên đầy đủ) + "Tổng quan phòng"', async () => {
    vi.spyOn(apiClient.auth, 'me').mockResolvedValue(HEAD);
    render(<TeamKpiScreen />);
    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['TaxOnline', 'iBHXH', 'iXHD', 'Tổng quan phòng']);
    expect(tabs[0]).toHaveAttribute('title', TEAMS[0]!.name);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(team).toHaveBeenLastCalledWith('t1', expect.anything()));

    fireEvent.click(screen.getByRole('tab', { name: 'iBHXH' }));
    await waitFor(() => expect(team).toHaveBeenLastCalledWith('t2', expect.anything()));

    fireEvent.click(screen.getByRole('tab', { name: 'Tổng quan phòng' }));
    expect(await screen.findByRole('table', { name: 'Theo team' })).toBeInTheDocument();
    expect(ov).toHaveBeenCalled();
  });

  it('Trưởng phòng: phím ←/→/Home/End chuyển tab, tab chọn giữ tabIndex 0, panel gắn aria-controls', async () => {
    vi.spyOn(apiClient.auth, 'me').mockResolvedValue(HEAD);
    render(<TeamKpiScreen />);
    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1, -1]);
    const panel = screen.getByRole('tabpanel');
    expect(tabs[0]).toHaveAttribute('aria-controls', panel.id);
    expect(panel).toHaveAttribute('aria-labelledby', tabs[0]!.id);

    fireEvent.keyDown(tabs[0]!, { key: 'ArrowRight' });
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveFocus();
    expect(tabs.map((t) => t.tabIndex)).toEqual([-1, 0, -1, -1]);
    expect(tabs[0]).not.toHaveAttribute('aria-controls');
    fireEvent.keyDown(tabs[1]!, { key: 'End' });
    expect(tabs[3]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(tabs[3]!, { key: 'ArrowRight' });
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(tabs[0]!, { key: 'ArrowLeft' });
    expect(tabs[3]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(tabs[3]!, { key: 'Home' });
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[0]).toHaveFocus();
  });

  it('đổi kỳ nhanh gọi lại kpi.team', async () => {
    vi.spyOn(apiClient.auth, 'me').mockResolvedValue(MANAGER);
    render(<TeamKpiScreen />);
    await screen.findByRole('table', { name: 'Thành viên' });
    fireEvent.click(screen.getByRole('button', { name: 'Tháng trước' }));
    await waitFor(() => expect(team).toHaveBeenLastCalledWith('t2', { from: '2026-10-16', to: '2026-11-15' }));
  });

  it('Nhân viên: hiện thông báo 403 của API', async () => {
    vi.spyOn(apiClient.auth, 'me').mockResolvedValue({ ...MANAGER, role: 'staff' });
    team.mockRejectedValue(new ApiError('FORBIDDEN', 403, 'Bạn không có quyền xem báo cáo team'));
    render(<TeamKpiScreen />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Bạn không có quyền xem báo cáo team');
  });
});
