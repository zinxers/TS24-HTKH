import { render, screen } from '@testing-library/react';
import type { CurrentUser } from '@ts24-htkh/shared';
import { describe, expect, it, vi } from 'vitest';
import { renderWithUser } from '../test/render-with-user';
import { useCurrentUser } from './current-user';

const user = { fullName: 'Nguyễn Văn A', email: 'a@ts24.vn' } as unknown as CurrentUser;

function Who() {
  return <p>{useCurrentUser().me.fullName}</p>;
}

describe('useCurrentUser', () => {
  it('ngoài Provider thì throw', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Who />)).toThrow('useCurrentUser phải nằm trong AppShell');
  });
  it('trong renderWithUser thấy me.fullName', () => {
    renderWithUser(<Who />, user);
    expect(screen.getByText('Nguyễn Văn A')).toBeTruthy();
  });
});
