'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, apiClient } from '../../lib/api-client';

// Không qua ConfirmDialog: đăng xuất không đổi dữ liệu nghiệp vụ.
export function LogoutButton({
  onError,
  className = 'text-btn',
  role,
}: {
  onError: (message: string | null) => void;
  className?: string;
  role?: 'menuitem';
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    onError(null);
    try {
      await apiClient.auth.logout();
    } catch (e) {
      // Cookie còn thì chuyển về /login cũng bị proxy đưa lại `/`: báo lỗi và ở lại.
      onError(`Đăng xuất không thành công: ${e instanceof ApiError ? e.message : 'Lỗi hệ thống, vui lòng thử lại'}`);
      setPending(false);
      return;
    }
    router.replace('/login');
  }

  return (
    <button className={className} role={role} type="button" onClick={onClick} disabled={pending}>
      Đăng xuất
    </button>
  );
}
