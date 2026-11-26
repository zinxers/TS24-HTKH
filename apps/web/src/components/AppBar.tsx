import type { ReactNode } from 'react';
import { Logo } from './Logo';
import { ThemeMenu } from './ThemeMenu';

/** Thanh trên: logo, nút Giao diện và menu tài khoản do màn hình truyền vào (features/profile/UserMenu). */
export function AppBar({ userMenu }: { userMenu?: ReactNode }) {
  return (
    <header className="bar">
      <Logo className="logo" />
      <div className="who">
        <ThemeMenu />
        {userMenu}
      </div>
    </header>
  );
}
