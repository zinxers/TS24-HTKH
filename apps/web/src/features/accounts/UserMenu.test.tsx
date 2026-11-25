import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient } from '../../lib/api-client';
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
  it('màn hình không truyền onUserChange: thanh trên vẫn hiện tên mới', async () => {
    vi.spyOn(apiClient.me, 'updateProfile').mockResolvedValue({ ...USER, fullName: 'Tên Mới' });
    render(<UserMenu user={USER} onLogoutError={() => {}} />);
    rename('Tên Mới');
    expect(await screen.findByRole('button', { name: 'Tài khoản Tên Mới' })).toBeInTheDocument();
  });

  it('hết phiên (401) khi sửa tên: tải lại trang', async () => {
    const reload = vi.fn();
    Object.defineProperty(window, 'location', { value: { ...realLocation, reload }, configurable: true });
    vi.spyOn(apiClient.me, 'updateProfile').mockRejectedValue(new ApiError('AUTH', 401, 'hết hạn'));
    render(<UserMenu user={USER} onLogoutError={() => {}} />);
    rename('Tên Mới');
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });
});
