'use client';

import type { CurrentUser, Role } from '@ts24-htkh/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogoutButton } from '../../features/auth/LogoutButton';
import { ApiError, apiClient } from '../../lib/api-client';

const ROLE_LABEL: Record<Role, string> = { head: 'Trưởng phòng', manager: 'Quản lý', staff: 'Nhân viên' };

function initials(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  return ((words[0]?.[0] ?? '') + (words.length > 1 ? (words.at(-1)?.[0] ?? '') : '')).toUpperCase();
}

export default function Page() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  useEffect(() => {
    const fail = (e: unknown) => setError(e instanceof ApiError ? e.message : 'Lỗi hệ thống, vui lòng thử lại');
    apiClient.auth.me().then(setUser, async (e: unknown) => {
      if (!(e instanceof ApiError && e.status === 401)) return fail(e);
      // Xóa cookie cũ trước, nếu không proxy sẽ đưa /login về lại `/`. Xóa lỗi thì báo, không chuyển (tránh vòng lặp).
      try {
        await apiClient.auth.logout();
      } catch (logoutFailure) {
        return fail(logoutFailure);
      }
      router.replace('/login');
    });
  }, [router, attempt]);

  function retry() {
    setError(null);
    setAttempt((n) => n + 1);
  }

  return (
    <>
      <header className="bar">
        <span className="app">TS24-HTKH</span>
        {user && (
          <div className="who">
            <span className="avatar" aria-hidden="true">
              {initials(user.fullName)}
            </span>
            <span className="name">{user.fullName}</span>
            <LogoutButton onError={setLogoutError} />
          </div>
        )}
      </header>
      <main className="content">
        {user ? (
          <>
            {logoutError && (
              <p role="alert" className="banner-error">
                {logoutError}
              </p>
            )}
            <h1>Xin chào, {user.fullName}</h1>
            <p>
              {ROLE_LABEL[user.role]} · {user.email}
            </p>
          </>
        ) : error ? (
          <div className="load-error">
            <p role="alert">{error}</p>
            <button className="text-btn" type="button" onClick={retry}>
              Thử lại
            </button>
          </div>
        ) : (
          <p aria-busy="true">Đang tải…</p>
        )}
      </main>
    </>
  );
}
