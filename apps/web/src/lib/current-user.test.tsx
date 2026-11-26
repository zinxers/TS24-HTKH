import { act, render, screen } from '@testing-library/react';
import type { CurrentUser } from '@ts24-htkh/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithUser } from '../test/render-with-user';
import { useCurrentUser } from './current-user';

const user = { fullName: 'Nguyễn Văn A', email: 'a@ts24.vn' } as unknown as CurrentUser;

function Who() {
  const { me, notice } = useCurrentUser();
  return (
    <p>
      {me.fullName}|{notice ?? '-'}
    </p>
  );
}

afterEach(() => vi.restoreAllMocks());

describe('useCurrentUser', () => {
  it('ngoài Provider thì throw', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Who />)).toThrow('useCurrentUser phải nằm trong AppShell');
  });
  it('trong renderWithUser thấy me.fullName', () => {
    renderWithUser(<Who />, user);
    expect(screen.getByText('Nguyễn Văn A|-')).toBeTruthy();
  });
  it('setNotice và setMe cập nhật state thật, consumer render lại', () => {
    const { value } = renderWithUser(<Who />, user);
    act(() => value.setNotice('lỗi x'));
    expect(screen.getByText('Nguyễn Văn A|lỗi x')).toBeTruthy();
    act(() => value.setMe({ ...user, fullName: 'Trần B' }));
    expect(screen.getByText('Trần B|lỗi x')).toBeTruthy();
    expect(value.setNotice).toHaveBeenCalledWith('lỗi x');
  });
});
