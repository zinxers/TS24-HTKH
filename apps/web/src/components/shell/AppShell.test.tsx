import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CurrentUser } from '@ts24-htkh/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient } from '../../lib/api-client';
import { useCurrentUser } from '../../lib/current-user';
import { AppShell } from './AppShell';

const replace = vi.fn();
// Router ổn định giữa các lần render, như useRouter thật của Next.
const router = { replace: (...args: unknown[]) => replace(...args) };
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/' }));

const USER: CurrentUser = {
  id: 'u1',
  email: 'quan.ly.1@example.com',
  fullName: 'Trần Thị Quản Lý Một',
  role: 'manager',
  teamId: 't1',
};

function Child() {
  const { me, setMe, setNotice } = useCurrentUser();
  return (
    <div>
      <p>Tên: {me.fullName}</p>
      <button type="button" onClick={() => setNotice('Lỗi X')}>báo lỗi</button>
      <button type="button" onClick={() => setMe({ ...me, fullName: 'Tên Mới' })}>đổi tên</button>
    </div>
  );
}

const shell = () =>
  render(
    <AppShell initialCollapsed={false} userMenu={<span>menu</span>}>
      <Child />
    </AppShell>,
  );

beforeEach(() => {
  vi.restoreAllMocks();
  replace.mockReset();
  document.cookie = 'sidebar=; Max-Age=0; Path=/';
});

describe('AppShell', () => {
  it('đang chờ me: khung chờ, chưa render con', () => {
    vi.spyOn(apiClient.auth, 'me').mockReturnValue(new Promise(() => {}));
    shell();
    expect(screen.getByRole('status', { name: 'Đang tải' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText(/^Tên:/)).toBeNull();
    expect(screen.queryByText('menu')).toBeNull();
  });

  it('me manager: con thấy người dùng, nav có KPI theo team, có userMenu', async () => {
    vi.spyOn(apiClient.auth, 'me').mockResolvedValue(USER);
    shell();
    expect(await screen.findByText('Tên: Trần Thị Quản Lý Một')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'KPI theo team' })).toBeInTheDocument();
    expect(screen.getByText('menu')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('401 và logout ok: logout một lần rồi về /login', async () => {
    vi.spyOn(apiClient.auth, 'me').mockRejectedValue(new ApiError('AUTH', 401, 'Hết phiên'));
    const logout = vi.spyOn(apiClient.auth, 'logout').mockResolvedValue(undefined);
    shell();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('401 và logout lỗi: hiện lỗi, không chuyển trang', async () => {
    vi.spyOn(apiClient.auth, 'me').mockRejectedValue(new ApiError('AUTH', 401, 'Hết phiên'));
    vi.spyOn(apiClient.auth, 'logout').mockRejectedValue(new ApiError('INTERNAL', 500, 'Lỗi máy chủ'));
    shell();
    expect(await screen.findByRole('alert')).toHaveTextContent('Lỗi máy chủ');
    expect(replace).not.toHaveBeenCalled();
  });

  it('me lỗi 500: hiện lỗi + Thử lại; bấm thì gọi lại và render con', async () => {
    const me = vi
      .spyOn(apiClient.auth, 'me')
      .mockRejectedValueOnce(new ApiError('INTERNAL', 500, 'Lỗi máy chủ'))
      .mockResolvedValueOnce(USER);
    shell();
    expect(await screen.findByRole('alert')).toHaveTextContent('Lỗi máy chủ');
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Tên: Trần Thị Quản Lý Một')).toBeInTheDocument();
    expect(me).toHaveBeenCalledTimes(2);
    expect(replace).not.toHaveBeenCalled();
  });

  it('con gọi setNotice: hiện thông báo', async () => {
    vi.spyOn(apiClient.auth, 'me').mockResolvedValue(USER);
    shell();
    fireEvent.click(await screen.findByRole('button', { name: 'báo lỗi' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Lỗi X');
  });

  it('con gọi setMe: thấy tên mới', async () => {
    vi.spyOn(apiClient.auth, 'me').mockResolvedValue(USER);
    shell();
    fireEvent.click(await screen.findByRole('button', { name: 'đổi tên' }));
    expect(await screen.findByText('Tên: Tên Mới')).toBeInTheDocument();
  });

  it('bấm Thu gọn thanh bên: lưu cookie', async () => {
    vi.spyOn(apiClient.auth, 'me').mockResolvedValue(USER);
    shell();
    await screen.findByText(/^Tên:/);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Thu gọn thanh bên' }));
    });
    expect(document.cookie).toContain('sidebar=collapsed');
    expect(screen.getByRole('button', { name: 'Mở rộng thanh bên' })).toBeInTheDocument();
  });
});
