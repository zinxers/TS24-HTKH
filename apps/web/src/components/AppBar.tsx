import type { CurrentUser } from '@ts24-htkh/shared';
import { LogoutButton } from '../features/auth/LogoutButton';

function initials(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  return ((words[0]?.[0] ?? '') + (words.length > 1 ? (words.at(-1)?.[0] ?? '') : '')).toUpperCase();
}

export function AppBar({ user, onLogoutError }: { user: CurrentUser | null; onLogoutError: (m: string | null) => void }) {
  return (
    <header className="bar">
      <span className="app">TS24-HTKH</span>
      {user && (
        <div className="who">
          <span className="avatar" aria-hidden="true">
            {initials(user.fullName)}
          </span>
          <span className="name">{user.fullName}</span>
          <LogoutButton onError={onLogoutError} />
        </div>
      )}
    </header>
  );
}
