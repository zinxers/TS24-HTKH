import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

/** Mở menu tài khoản trên thanh trên (Sửa họ tên, Đăng xuất nằm trong đó). */
async function openUserMenu() {
  fireEvent.click(await screen.findByRole('button', { name: /^Tài khoản / }));
}

beforeEach(() => {
  vi.restoreAllMocks();
  replace.mockReset();
});

describe('trang /: tài khoản', () => {
  it.each([
    ['head', true],
    ['manager', true],
    ['staff', false],
  ] as const)('%s: liên kết Quản lý tài khoản hiện = %s', async (role, shown) => {
    vi.spyOn(apiClient.auth, 'me').mockResolvedValue({ ...USER, role, teamId: role === 'head' ? null : 't1' });
    render(<Page />);
    await screen.findByRole('heading', { level: 1 });
    const link = screen.queryByRole('link', { name: /Quản lý tài khoản/ });
    if (shown) expect(link).toHaveAttribute('href', '/accounts');
    else expect(link).not.toBeInTheDocument();
  });

  it.each([
    ['head', true],
    ['manager', true],
    ['staff', false],
  ] as const)('%s: liên kết KPI theo team hiện = %s', async (role, shown) => {
    vi.spyOn(apiClient.auth, 'me').mockResolvedValue({ ...USER, role, teamId: role === 'head' ? null : 't1' });
    render(<Page />);
    await screen.findByRole('heading', { level: 1 });
    const link = screen.queryByRole('link', { name: /KPI theo team/ });
    if (shown) expect(link).toHaveAttribute('href', '/team');
    else expect(link).not.toBeInTheDocument();
  });

  it('mọi vai trò có ô Báo cáo KPI, KPI của tôi, Đơn giá KPI', async () => {
    vi.spyOn(apiClient.auth, 'me').mockResolvedValue({ ...USER, role: 'staff' });
    render(<Page />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('link', { name: /^Báo cáo KPI/ })).toHaveAttribute('href', '/kpi');
    expect(screen.getByRole('link', { name: /KPI của tôi/ })).toHaveAttribute('href', '/kpi/mine');
    expect(screen.getByRole('link', { name: /Đơn giá KPI/ })).toHaveAttribute('href', '/kpi/rates');
  });

  it('nhân viên chỉ thấy 3 ô', async () => {
    vi.spyOn(apiClient.auth, 'me').mockResolvedValue({ ...USER, role: 'staff' });
    render(<Page />);
    const nav = await screen.findByRole('navigation', { name: 'Thao tác' });
    expect(within(nav).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/kpi', '/kpi/mine', '/kpi/rates']);
  });

  it('nhãn vai trò Nhân Viên', async () => {
    vi.spyOn(apiClient.auth, 'me').mockResolvedValue({ ...USER, role: 'staff' });
    render(<Page />);
    expect(await screen.findByText(/Nhân Viên · /)).toBeInTheDocument();
  });

  it('Sửa họ tên: form → xác nhận → API, cập nhật lời chào', async () => {
    vi.spyOn(apiClient.auth, 'me').mockResolvedValue(USER);
    const update = vi.spyOn(apiClient.me, 'updateProfile').mockResolvedValue({ ...USER, fullName: 'Tên Mới' });
    render(<Page />);
    await openUserMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sửa họ tên' }));
    const form = screen.getByRole('dialog', { name: 'Sửa họ tên' });
    fireEvent.change(screen.getByLabelText('Họ tên'), { target: { value: 'Tên Mới' } });
    fireEvent.submit(form.querySelector('form')!);
    expect(update).not.toHaveBeenCalled();
    const confirm = screen.getAllByRole('dialog').at(-1)!;
    fireEvent.click(within(confirm).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('Tên Mới'));
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Xin chào, Tên Mới');
    expect(screen.getByRole('button', { name: 'Tài khoản Tên Mới' })).toBeInTheDocument();
    // Hộp xác nhận đóng trong finally của useConfirmAction, sau khi tên đã đổi.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('trang /', () => {
  it('me trả user → hiện họ tên, vai trò; menu tài khoản có Sửa họ tên và Đăng xuất', async () => {
    vi.spyOn(apiClient.auth, 'me').mockResolvedValue(USER);
    render(<Page />);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Xin chào, Trần Thị Quản Lý Một');
    expect(screen.getAllByText(/Quản lý · quan.ly.1@example.com/)).toHaveLength(1);
    await openUserMenu();
    expect(screen.getByRole('menuitem', { name: 'Sửa họ tên' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Đăng xuất' })).toBeInTheDocument();
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
    await openUserMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Đăng xuất' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Đăng xuất không thành công: Lỗi hệ thống, vui lòng thử lại');
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole('menuitem', { name: 'Đăng xuất' })).toBeEnabled();
  });

  it('Đăng xuất → gọi logout rồi về /login', async () => {
    vi.spyOn(apiClient.auth, 'me').mockResolvedValue(USER);
    const logout = vi.spyOn(apiClient.auth, 'logout').mockResolvedValue();
    render(<Page />);
    await openUserMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Đăng xuất' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(logout).toHaveBeenCalled();
  });
});
