import type { CurrentUser } from '@ts24-htkh/shared';
import { UserMenu } from '../features/accounts/UserMenu';
import { Logo } from './Logo';
import { ThemeMenu } from './ThemeMenu';

export function AppBar({
  user,
  onUserChange,
  onLogoutError,
}: {
  user: CurrentUser | null;
  onUserChange?: (user: CurrentUser) => void;
  onLogoutError: (m: string | null) => void;
}) {
  return (
    <header className="bar">
      <Logo className="logo" />
      <div className="who">
        <ThemeMenu />
        {user && <UserMenu user={user} onUserChange={onUserChange} onLogoutError={onLogoutError} />}
      </div>
    </header>
  );
}
