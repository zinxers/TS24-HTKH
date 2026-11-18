import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient } from '../../lib/api-client';
import Page from './page';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const USER = {
  id: 'u1',
  email: 'quan.ly.1@example.com',
  fullName: 'Trần Thị Quản Lý Một',
  role: 'manager' as const,
  teamId: 't1',
};

beforeEach(() => {
  vi.restoreAllMocks();
  replace.mockReset();
});

describe('trang /', () => {
  it('me trả user → hiện họ tên, vai trò và nút Đăng xuất', async () => {
    vi.spyOn(apiClient.auth, 'me').mockResolvedValue(USER);
    render(<Page />);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Xin chào, Trần Thị Quản Lý Một');
    expect(screen.getByText(/Quản lý · quan.ly.1@example.com/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeInTheDocument();
  });

  it('me 401 → xóa cookie qua logout rồi về /login', async () => {
    vi.spyOn(apiClient.auth, 'me').mockRejectedValue(new ApiError('AUTH', 401, 'hết hạn'));
    const logout = vi.spyOn(apiClient.auth, 'logout').mockResolvedValue();
    render(<Page />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(logout).toHaveBeenCalled();
  });

  it('Đăng xuất → gọi logout rồi về /login', async () => {
    vi.spyOn(apiClient.auth, 'me').mockResolvedValue(USER);
    const logout = vi.spyOn(apiClient.auth, 'logout').mockResolvedValue();
    render(<Page />);
    fireEvent.click(await screen.findByRole('button', { name: 'Đăng xuất' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(logout).toHaveBeenCalled();
  });
});
