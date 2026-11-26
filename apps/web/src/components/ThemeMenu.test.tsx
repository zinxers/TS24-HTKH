import { fireEvent, render, screen, within } from '@testing-library/react';
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
    const menu = screen.getByRole('menu', { name: 'Giao diện' });
    expect(within(menu).getAllByRole('menuitemradio')).toEqual(
      ['Theo hệ thống', 'Sáng', 'Tối'].map((name) => screen.getByRole('menuitemradio', { name })),
    );
    expect(within(menu).queryByRole('button', { name: 'Hủy' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Theo hệ thống' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Tối' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.getByRole('menuitemradio', { name: 'Tối' })).toHaveAttribute('aria-checked', 'true');
  });

  it('nút có sẵn cả 3 icon (CSS chọn theo html[data-theme]) để HTML server không đổi sau khi mount', () => {
    render(<ThemeMenu />);
    const icons = screen.getByRole('button', { name: 'Giao diện' }).querySelectorAll('svg[data-icon]');
    expect([...icons].map((i) => i.getAttribute('data-icon'))).toEqual(['system', 'light', 'dark']);
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
