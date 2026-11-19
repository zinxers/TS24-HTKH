'use client';

import type { CurrentUser } from '@ts24-htkh/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppBar } from '../../components/AppBar';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ProfileDialog } from '../../features/accounts/AccountDialogs';
import { ROLE_LABEL } from '../../features/accounts/labels';
import { useConfirmAction } from '../../features/accounts/useConfirmAction';
import { ApiError, apiClient } from '../../lib/api-client';

export default function Page() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  // Hết phiên khi sửa: tải lại `me` để chạy đúng luồng 401 bên dưới.
  const action = useConfirmAction(() => setAttempt((n) => n + 1));

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
      <AppBar user={user} onLogoutError={setLogoutError} />
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
            <nav className="group menu" aria-label="Thao tác">
              {user.role !== 'staff' && (
                <Link className="menu-row" href="/accounts">
                  Quản lý tài khoản{' '}
                  <span className="chev" aria-hidden="true">
                    ›
                  </span>
                </Link>
              )}
              <button className="menu-row" type="button" onClick={() => setEditing(true)}>
                Sửa họ tên{' '}
                <span className="chev" aria-hidden="true">
                  ›
                </span>
              </button>
            </nav>
            {editing && (
              <ProfileDialog
                fullName={user.fullName}
                error={action.error}
                busy={action.busy}
                onCancel={() => setEditing(false)}
                onSubmit={(fullName) =>
                  action.ask({
                    title: 'Sửa họ tên',
                    message: `Đổi họ tên thành “${fullName.trim()}”?`,
                    confirmLabel: 'Lưu',
                    run: async () => {
                      setUser(await apiClient.me.updateProfile(fullName));
                      setEditing(false);
                    },
                  })
                }
              />
            )}
            <ConfirmDialog {...action.dialogProps} />
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
