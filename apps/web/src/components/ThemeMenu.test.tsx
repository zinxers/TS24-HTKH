import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ThemeMenu } from './ThemeMenu';

afterEach(() => {
  document.cookie = 'theme=; Path=/; Max-Age=0';
  delete document.documentElement.dataset.theme;
});

describe('ThemeMenu', () => {
  it('mặc định Theo hệ thống; chọn Tối thì áp dụng, đóng menu và nhớ lựa chọn', () => {
    render(<ThemeMenu />);
    const btn = screen.getByRole('button', { name: 'Giao diện' });
    expect(btn).toHaveAttribute('aria-haspopup', 'menu');
    fireEvent.click(btn);
    expect(screen.getByRole('menu', { name: 'Giao diện' })).toBeInTheDocument();
    expect(screen.getAllByRole('menuitemradio').map((e) => e.textContent)).toEqual(['✓Theo hệ thống', '✓Sáng', '✓Tối']);
    expect(screen.getByRole('menuitemradio', { name: /Theo hệ thống/ })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Tối/ }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.getByRole('menuitemradio', { name: /Tối/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('Esc đóng menu và trả focus về nút', () => {
    render(<ThemeMenu />);
    const btn = screen.getByRole('button', { name: 'Giao diện' });
    fireEvent.click(btn);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(btn).toHaveFocus();
  });

  it('Hủy trả focus về nút', () => {
    render(<ThemeMenu />);
    const btn = screen.getByRole('button', { name: 'Giao diện' });
    fireEvent.click(btn);
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(btn).toHaveFocus();
  });
});
