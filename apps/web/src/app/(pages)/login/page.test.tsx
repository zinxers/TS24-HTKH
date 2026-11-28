import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LoginPage from './page';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));

describe('/login', () => {
  it('một h1, logo, tên công ty; hình minh họa chỉ để trang trí', () => {
    const { container } = render(<LoginPage />);
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Đăng nhập']);
    // jsdom không áp CSS nên cả logo nửa trái lẫn logo khổ hẹp đều có mặt.
    expect(screen.getAllByRole('img', { name: 'TS24 Hỗ trợ khách hàng' })).toHaveLength(2);
    expect(screen.getByText('Công ty Cổ phần TS24 · Phòng Hỗ trợ Khách hàng')).toBeInTheDocument();
    const art = container.querySelector('img[src="/login-art.png"]');
    expect(art).toHaveAttribute('alt', '');
    expect(art?.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
