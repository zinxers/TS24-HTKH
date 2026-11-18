import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient } from '../../lib/api-client';
import Page from './page';

const replace = vi.fn();
// Router ổn định giữa các lần render, như useRouter thật của Next.
const router = { replace: (...args: unknown[]) => replace(...args) };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

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

  it('me lỗi khác 401 → hiện câu lỗi, Thử lại gọi lại me', async () => {
    const me = vi
      .spyOn(apiClient.auth, 'me')
      .mockRejectedValueOnce(new ApiError('INTERNAL', 500, 'Lỗi hệ thống, vui lòng thử lại'))
      .mockResolvedValueOnce(USER);
    render(<Page />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Lỗi hệ thống, vui lòng thử lại');
    expect(replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Xin chào, Trần Thị Quản Lý Một');
    expect(me).toHaveBeenCalledTimes(2);
  });

  it('me lỗi mạng (không phải ApiError) → hiện câu lỗi chung', async () => {
    vi.spyOn(apiClient.auth, 'me').mockRejectedValue(new TypeError('Failed to fetch'));
    render(<Page />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Lỗi hệ thống, vui lòng thử lại');
  });

  it('me 401 mà xóa cookie lỗi → báo lỗi, không chuyển trang (tránh vòng lặp với proxy)', async () => {
    vi.spyOn(apiClient.auth, 'me').mockRejectedValue(new ApiError('AUTH', 401, 'hết hạn'));
    vi.spyOn(apiClient.auth, 'logout').mockRejectedValue(new TypeError('Failed to fetch'));
    render(<Page />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Lỗi hệ thống, vui lòng thử lại');
    expect(replace).not.toHaveBeenCalled();
  });

  it('Đăng xuất lỗi → báo lỗi, ở lại trang, mở lại nút', async () => {
    vi.spyOn(apiClient.auth, 'me').mockResolvedValue(USER);
    vi.spyOn(apiClient.auth, 'logout').mockRejectedValue(new ApiError('INTERNAL', 500, 'Lỗi hệ thống, vui lòng thử lại'));
    render(<Page />);
    fireEvent.click(await screen.findByRole('button', { name: 'Đăng xuất' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Đăng xuất không thành công: Lỗi hệ thống, vui lòng thử lại');
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeEnabled();
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
