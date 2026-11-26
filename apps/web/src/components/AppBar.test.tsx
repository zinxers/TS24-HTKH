import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppBar } from './AppBar';

describe('AppBar', () => {
  it('hiện logo thay cho chữ TS24-HTKH; chưa có user thì chỉ có nút Giao diện', () => {
    render(<AppBar />);
    expect(screen.getByRole('img', { name: 'TS24 Hỗ trợ khách hàng' })).toBeInTheDocument();
    expect(screen.queryByText('TS24-HTKH')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Giao diện']);
  });

  it('có user: hiện menu tài khoản màn hình truyền vào, sau nút Giao diện', () => {
    render(<AppBar userMenu={<button type="button">Tài khoản Lê Văn A</button>} />);
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual([
      'Giao diện',
      'Tài khoản Lê Văn A',
    ]);
  });
});
