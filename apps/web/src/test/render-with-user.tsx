import { render, type RenderResult } from '@testing-library/react';
import type { CurrentUser } from '@ts24-htkh/shared';
import { useEffect, useState, type ReactElement } from 'react';
import { vi } from 'vitest';
import { CurrentUserContext, type CurrentUserValue } from '../lib/current-user';

/** Chỉ cho test: bọc ui trong CurrentUserContext; setMe/setNotice là spy nhưng vẫn cập nhật state thật. */
export function renderWithUser(
  ui: ReactElement,
  user: CurrentUser,
  overrides: Partial<CurrentUserValue> = {},
): RenderResult & { value: CurrentUserValue } {
  const real: { setMe?: (u: CurrentUser) => void; setNotice?: (m: string | null) => void } = {};
  // Handle ổn định cho test; me/notice được cập nhật theo lần render mới nhất.
  const value: CurrentUserValue = {
    me: user,
    notice: null,
    setMe: vi.fn((u: CurrentUser) => real.setMe?.(u)),
    setNotice: vi.fn((m: string | null) => real.setNotice?.(m)),
    leave: vi.fn(async () => {}),
    ...overrides,
  };

  function Provider({ children }: { children: ReactElement }) {
    const [me, setMe] = useState(user);
    const [notice, setNotice] = useState<string | null>(null);
    useEffect(() => {
      real.setMe = setMe;
      real.setNotice = setNotice;
    }, []);
    value.me = me;
    value.notice = notice;
    // Object mới mỗi lần render để consumer render lại.
    return <CurrentUserContext.Provider value={{ ...value }}>{children}</CurrentUserContext.Provider>;
  }

  return Object.assign(render(<Provider>{ui}</Provider>), { value });
}
