import { render, type RenderResult } from '@testing-library/react';
import type { CurrentUser } from '@ts24-htkh/shared';
import { useState, type ReactElement } from 'react';
import { vi } from 'vitest';
import { CurrentUserContext, type CurrentUserValue } from '../lib/current-user';

/** Chỉ cho test: bọc ui trong CurrentUserContext; setMe/setNotice là spy nhưng vẫn cập nhật state thật. */
export function renderWithUser(
  ui: ReactElement,
  user: CurrentUser,
  overrides: Partial<CurrentUserValue> = {},
): RenderResult & { value: CurrentUserValue } {
  const setMe = vi.fn();
  const setNotice = vi.fn();
  const leave = vi.fn(async () => {});
  const value = {} as CurrentUserValue;

  function Provider({ children }: { children: ReactElement }) {
    const [me, setMeState] = useState(user);
    const [notice, setNoticeState] = useState<string | null>(null);
    setMe.mockImplementation(setMeState);
    setNotice.mockImplementation(setNoticeState);
    Object.assign(value, { me, setMe, notice, setNotice, leave, ...overrides });
    return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
  }

  const result = render(<Provider>{ui}</Provider>);
  return Object.assign(result, { value });
}
