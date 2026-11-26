'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Role } from '@ts24-htkh/shared';
import { Logo, ShieldMark } from '../Logo';
import { NavGlyph } from './icons';
import { isActive, navFor } from './nav';

const SPRING = { type: 'spring', stiffness: 500, damping: 40 } as const;

interface SidebarProps {
  role: Role | null; // null: chưa có thông tin người dùng, chỉ hiện logo
  collapsed: boolean;
  onToggle?: () => void; // không truyền (ngăn kéo): không có nút thu/mở
  onNavigate?: () => void; // ngăn kéo: đóng khi chọn mục
  userMenu?: ReactNode;
}

export function Sidebar({ role, collapsed, onToggle, onNavigate, userMenu }: SidebarProps) {
  const pathname = usePathname();
  const items = role ? navFor(role) : [];
  return (
    <motion.aside
      className={`side${collapsed ? ' is-collapsed' : ''}`}
      initial={false}
      animate={{ width: collapsed ? 72 : 248 }}
      transition={SPRING}
    >
      <div className="brand">
        <Logo className="logo-wide" onDark />
        <span className="logo-mark">
          <ShieldMark onDark />
        </span>
        {onToggle && (
          <button
            type="button"
            className="toggle"
            onClick={onToggle}
            aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
            aria-expanded={!collapsed}
            aria-controls="main-nav"
          >
            <svg className="i" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 6-6 6 6 6" />
            </svg>
          </button>
        )}
      </div>
      <nav id="main-nav" className="nav" aria-label="Điều hướng chính">
        {items.map((item) => {
          const active = isActive(item.href, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              data-tip={item.label}
              aria-current={active ? 'page' : undefined}
              onClick={onNavigate}
            >
              {active && (
                <motion.span layoutId="nav-active" className="nav-active" transition={SPRING} />
              )}
              <NavGlyph name={item.icon} />
              <motion.span
                className="lbl"
                initial={false}
                animate={{ opacity: collapsed ? 0 : 1, x: collapsed ? 4 : 0 }}
              >
                {item.label}
              </motion.span>
            </Link>
          );
        })}
      </nav>
      {userMenu && <div className="side-foot">{userMenu}</div>}
    </motion.aside>
  );
}
