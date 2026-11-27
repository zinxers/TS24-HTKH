import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithUser } from '../../../test/render-with-user';
import Page from './page';

const USER = {
  id: 'u1',
  email: 'quan.ly.1@example.com',
  fullName: 'Trần Thị Quản Lý Một',
  role: 'manager' as const,
  teamId: 't1',
};

describe('trang /: tài khoản', () => {
  it.each([
    ['head', true],
    ['manager', true],
    ['staff', false],
  ] as const)('%s: liên kết Quản lý tài khoản hiện = %s', (role, shown) => {
    renderWithUser(<Page />, { ...USER, role, teamId: role === 'head' ? null : 't1' });
    const link = screen.queryByRole('link', { name: /Quản lý tài khoản/ });
    if (shown) expect(link).toHaveAttribute('href', '/accounts');
    else expect(link).not.toBeInTheDocument();
  });

  it.each([
    ['head', true],
    ['manager', true],
    ['staff', false],
  ] as const)('%s: liên kết KPI theo team hiện = %s', (role, shown) => {
    renderWithUser(<Page />, { ...USER, role, teamId: role === 'head' ? null : 't1' });
    const link = screen.queryByRole('link', { name: /KPI theo team/ });
    if (shown) expect(link).toHaveAttribute('href', '/team');
    else expect(link).not.toBeInTheDocument();
  });

  it('mọi vai trò có ô Báo cáo KPI, KPI của tôi, Đơn giá KPI', () => {
    renderWithUser(<Page />, { ...USER, role: 'staff' });
    expect(screen.getByRole('link', { name: /^Báo cáo KPI/ })).toHaveAttribute('href', '/kpi');
    expect(screen.getByRole('link', { name: /KPI của tôi/ })).toHaveAttribute('href', '/kpi/mine');
    expect(screen.getByRole('link', { name: /Đơn giá KPI/ })).toHaveAttribute('href', '/kpi/rates');
  });

  it('nhân viên chỉ thấy 3 ô', () => {
    renderWithUser(<Page />, { ...USER, role: 'staff' });
    const nav = screen.getByRole('navigation', { name: 'Thao tác' });
    expect(within(nav).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/kpi', '/kpi/mine', '/kpi/rates']);
  });

  it('nhãn vai trò Nhân Viên', () => {
    renderWithUser(<Page />, { ...USER, role: 'staff' });
    expect(screen.getByText(/Nhân Viên · /)).toBeInTheDocument();
  });

  it('hiện họ tên, vai trò và email trong lời chào', () => {
    renderWithUser(<Page />, USER);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Xin chào, Trần Thị Quản Lý Một');
    expect(screen.getAllByText(/Quản lý · quan.ly.1@example.com/)).toHaveLength(1);
  });
});
