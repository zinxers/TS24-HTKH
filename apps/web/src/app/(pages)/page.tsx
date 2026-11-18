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

  useEffect(() => {
    apiClient.auth.me().then(setUser, async (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) {
        // Xóa cookie cũ trước, nếu không proxy sẽ đưa /login về lại `/`.
        await apiClient.auth.logout().catch(() => undefined);
        router.replace('/login');
      }
    });
  }, [router]);

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
            <LogoutButton />
          </div>
        )}
      </header>
      <main className="content">
        {user ? (
          <>
            <h1>Xin chào, {user.fullName}</h1>
            <p>
              {ROLE_LABEL[user.role]} · {user.email}
            </p>
          </>
        ) : (
          <p aria-busy="true">Đang tải…</p>
        )}
      </main>
    </>
  );
}
