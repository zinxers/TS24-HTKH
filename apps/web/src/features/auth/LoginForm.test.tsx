import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient } from '../../lib/api-client';
import { LoginForm } from './LoginForm';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const USER = { id: 'u1', email: 'a@b.vn', fullName: 'A', role: 'staff' as const, teamId: 't1' };

function fill() {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.vn' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'matkhau' } });
  fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
}

beforeEach(() => {
  vi.restoreAllMocks();
  replace.mockReset();
});

describe('LoginForm', () => {
  it('ô nhập có nhãn và autocomplete đúng', () => {
    render(<LoginForm />);
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('Mật khẩu')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Mật khẩu')).toHaveAttribute('autocomplete', 'current-password');
  });

  it('gửi email/mật khẩu, khóa nút khi chờ, đúng thì về /', async () => {
    let resolve!: (u: typeof USER) => void;
    const login = vi.spyOn(apiClient.auth, 'login').mockReturnValue(new Promise((r) => (resolve = r)));
    render(<LoginForm />);
    fill();
    expect(login).toHaveBeenCalledWith({ email: 'a@b.vn', password: 'matkhau' });
    expect(await screen.findByRole('button', { name: /Đang đăng nhập/ })).toBeDisabled();
    resolve(USER);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
  });

  it('lỗi từ API → hiện đúng message, mở lại nút', async () => {
    vi.spyOn(apiClient.auth, 'login').mockRejectedValue(
      new ApiError('AUTH', 401, 'Email hoặc mật khẩu không đúng'),
    );
    render(<LoginForm />);
    fill();
    expect(await screen.findByRole('alert')).toHaveTextContent('Email hoặc mật khẩu không đúng');
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeEnabled();
    expect(replace).not.toHaveBeenCalled();
  });
  it('nút Hiện/Ẩn đổi kiểu ô mật khẩu, không gửi form', () => {
    const login = vi.spyOn(apiClient.auth, 'login');
    render(<LoginForm />);
    const pw = screen.getByLabelText('Mật khẩu');
    fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
    expect(pw).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: 'Ẩn mật khẩu' }));
    expect(pw).toHaveAttribute('type', 'password');
    expect(login).not.toHaveBeenCalled();
  });
});
