import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';

const pathname = vi.hoisted(() => ({ value: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.value }));

const LEAD = ['KPI theo team', 'Báo cáo tổng hợp', 'Quản lý tài khoản'];

describe('Sidebar', () => {
  beforeEach(() => {
    pathname.value = '/';
  });

  it('staff: không thấy mục dành cho quản lý', () => {
    render(<Sidebar role="staff" collapsed={false} />);
    expect(screen.getByRole('link', { name: 'Báo cáo KPI' })).toBeInTheDocument();
    for (const n of LEAD) expect(screen.queryByRole('link', { name: n })).toBeNull();
  });

  it('head: đủ 7 link đúng href', () => {
    render(<Sidebar role="head" collapsed={false} />);
    const links = within(screen.getByRole('navigation', { name: 'Điều hướng chính' })).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/', '/kpi', '/kpi/mine', '/kpi/rates', '/team', '/reports', '/accounts',
    ]);
  });

  it('đánh dấu aria-current theo pathname', () => {
    pathname.value = '/kpi/mine';
    render(<Sidebar role="staff" collapsed={false} />);
    expect(screen.getByRole('link', { name: 'KPI của tôi' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Báo cáo KPI' })).not.toHaveAttribute('aria-current');
  });

  it('role null: không có link', () => {
    render(<Sidebar role={null} collapsed={false} />);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('nút thu/mở', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<Sidebar role="staff" collapsed={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: 'Thu gọn thanh bên' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(<Sidebar role="staff" collapsed onToggle={onToggle} />);
    expect(screen.getByRole('button', { name: 'Mở rộng thanh bên' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('thu gọn: link giữ tên truy cập và có title', () => {
    render(<Sidebar role="staff" collapsed />);
    expect(screen.getByRole('link', { name: 'Đơn giá KPI' })).toHaveAttribute('title', 'Đơn giá KPI');
  });

  it('không onToggle: không có nút; chọn link gọi onNavigate', () => {
    const onNavigate = vi.fn();
    render(<Sidebar role="staff" collapsed={false} onNavigate={onNavigate} />);
    expect(screen.queryByRole('button')).toBeNull();
    const link = screen.getByRole('link', { name: 'Đơn giá KPI' });
    link.addEventListener('click', (e) => e.preventDefault()); // jsdom không điều hướng được
    fireEvent.click(link);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('render userMenu', () => {
    render(<Sidebar role="staff" collapsed={false} userMenu={<span>menu-nguoi-dung</span>} />);
    expect(screen.getByText('menu-nguoi-dung')).toBeInTheDocument();
  });
});
