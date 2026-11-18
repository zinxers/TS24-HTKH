'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiClient } from '../../lib/api-client';

// Không qua ConfirmDialog: đăng xuất không đổi dữ liệu nghiệp vụ.
export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    // Lỗi mạng: vẫn chuyển trang; cookie còn thì proxy đưa về lại `/`.
    await apiClient.auth.logout().catch(() => undefined);
    router.replace('/login');
  }

  return (
    <button className="text-btn" type="button" onClick={onClick} disabled={pending}>
      Đăng xuất
    </button>
  );
}
