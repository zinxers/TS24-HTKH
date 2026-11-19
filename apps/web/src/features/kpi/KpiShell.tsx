'use client';

import type { CurrentUser } from '@ts24-htkh/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AppBar } from '../../components/AppBar';
import { ApiError, apiClient } from '../../lib/api-client';
import { errorMessage } from '../accounts/labels';

/** Số nguyên dạng 1.234.567 (không phụ thuộc ICU của máy). */
export const fmtNumber = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
/** 2026-11-19 → 19/11/2026. */
export const fmtDate = (iso: string) => iso.split('-').reverse().join('/');

/** Người dùng hiện tại + đăng xuất khi hết phiên (401) + thông báo chung của trang. */
export function useKpiUser() {
  const router = useRouter();
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Xóa cookie cũ trước, nếu không proxy sẽ đưa /login về lại trang này.
  const leave = useCallback(async () => {
    try {
      await apiClient.auth.logout();
    } catch (e) {
      setNotice(errorMessage(e));
      return;
    }
    router.replace('/login');
  }, [router]);

  useEffect(() => {
    apiClient.auth.me().then(setMe, (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) void leave();
      else setNotice(errorMessage(e));
    });
  }, [leave]);

  return { me, notice, setNotice, leave };
}

/** Khung chung: AppBar, liên kết về trang chủ, thông báo; `me` null thì hiện trạng thái tải. */
export function KpiShell({
  me,
  notice,
  onNotice,
  children,
}: {
  me: CurrentUser | null;
  notice: string | null;
  onNotice: (m: string | null) => void;
  children: ReactNode;
}) {
  return (
    <>
      <AppBar user={me} onLogoutError={onNotice} />
      <main className="content wide">
        <Link className="back" href="/">
          ‹ Trang chủ
        </Link>
        {notice && (
          <p role="alert" className="banner-error">
            {notice}
          </p>
        )}
        {me ? children : !notice && <p aria-busy="true">Đang tải…</p>}
      </main>
    </>
  );
}
