import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient } from '../../lib/api-client';
import { renderWithUser } from '../../test/render-with-user';
import { UserMenu } from './UserMenu';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));

const USER = { id: 'u1', email: 'nhan.vien.1a@example.com', fullName: 'Lê Văn Một A', role: 'staff' as const, teamId: 't1' };
const realLocation = window.location;

function rename(to: string) {
  fireEvent.click(screen.getByRole('button', { name: /^Tài khoản / }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Sửa họ tên' }));
  fireEvent.change(screen.getByLabelText('Họ tên'), { target: { value: to } });
  fireEvent.submit(screen.getByRole('dialog', { name: 'Sửa họ tên' }).querySelector('form')!);
  fireEvent.click(within(screen.getAllByRole('dialog').at(-1)!).getByRole('button', { name: 'Lưu' }));
}

beforeEach(() => vi.restoreAllMocks());
afterEach(() => Object.defineProperty(window, 'location', { value: realLocation, configurable: true }));

describe('UserMenu', () => {
  it('đổi tên thành công: setMe với tên mới và nút hiện tên mới', async () => {
    const updated = { ...USER, fullName: 'Tên Mới' };
    vi.spyOn(apiClient.me, 'updateProfile').mockResolvedValue(updated);
    const { value } = renderWithUser(<UserMenu />, USER);
    rename('Tên Mới');
    expect(await screen.findByRole('button', { name: 'Tài khoản Tên Mới' })).toBeInTheDocument();
    expect(value.setMe).toHaveBeenCalledWith(updated);
  });

  it('hết phiên (401) khi sửa tên: tải lại trang', async () => {
    const reload = vi.fn();
    Object.defineProperty(window, 'location', { value: { ...realLocation, reload }, configurable: true });
    vi.spyOn(apiClient.me, 'updateProfile').mockRejectedValue(new ApiError('AUTH', 401, 'hết hạn'));
    renderWithUser(<UserMenu />, USER);
    rename('Tên Mới');
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });

  it('đăng xuất lỗi: đóng menu, trả focus về nút và báo lỗi', async () => {
    vi.spyOn(apiClient.auth, 'logout').mockRejectedValue(new ApiError('INTERNAL', 500, 'Lỗi máy chủ'));
    const { value } = renderWithUser(<UserMenu />, USER);
    const btn = screen.getByRole('button', { name: /^Tài khoản / });
    fireEvent.click(btn);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Đăng xuất' }));
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    expect(btn).toHaveFocus();
    expect(value.setNotice).toHaveBeenLastCalledWith('Đăng xuất không thành công: Lỗi máy chủ');
  });

  it('menu chỉ chứa mục chọn; họ tên, email và nút Hủy nằm ngoài role=menu', () => {
    renderWithUser(<UserMenu />, USER);
    fireEvent.click(screen.getByRole('button', { name: /^Tài khoản / }));
    const menu = screen.getByRole('menu', { name: 'Tài khoản' });
    expect(within(menu).queryByText(/nhan\.vien\.1a@example\.com/)).not.toBeInTheDocument();
    expect(within(menu).queryByRole('button', { name: 'Hủy' })).not.toBeInTheDocument();
    expect(menu).toHaveAccessibleDescription(/Lê Văn Một A.*nhan\.vien\.1a@example\.com/);
  });
});
