'use client';

import type { CurrentUser } from '@ts24-htkh/shared';
import { createContext, useContext } from 'react';

export interface CurrentUserValue {
  /** Luôn có: AppShell chỉ render màn hình khi đã có me. */
  me: CurrentUser;
  setMe: (user: CurrentUser) => void;
  /** Banner lỗi chung. */
  notice: string | null;
  setNotice: (message: string | null) => void;
  /** Đăng xuất rồi về /login; đăng xuất lỗi thì setNotice, không chuyển trang. */
  leave: () => Promise<void>;
}

export const CurrentUserContext = createContext<CurrentUserValue | null>(null);

export function useCurrentUser(): CurrentUserValue {
  const value = useContext(CurrentUserContext);
  if (!value) throw new Error('useCurrentUser phải nằm trong AppShell');
  return value;
}
