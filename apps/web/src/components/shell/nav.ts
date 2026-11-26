import type { Role } from '@ts24-htkh/shared';

export type NavIcon = 'home' | 'kpi' | 'mine' | 'rates' | 'team' | 'reports' | 'accounts';
/** lead: chỉ Trưởng phòng/Quản lý (gợi ý giao diện; luật nằm ở backend). */
export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  lead?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Trang chủ', icon: 'home' },
  { href: '/kpi', label: 'Báo cáo KPI', icon: 'kpi' },
  { href: '/kpi/mine', label: 'KPI của tôi', icon: 'mine' },
  { href: '/kpi/rates', label: 'Đơn giá KPI', icon: 'rates' },
  { href: '/team', label: 'KPI theo team', icon: 'team', lead: true },
  { href: '/reports', label: 'Báo cáo tổng hợp', icon: 'reports', lead: true },
  { href: '/accounts', label: 'Quản lý tài khoản', icon: 'accounts', lead: true },
];

export function navFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((i) => !i.lead || role !== 'staff');
}

export function isActive(href: string, pathname: string): boolean {
  const p = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  return p === href;
}
