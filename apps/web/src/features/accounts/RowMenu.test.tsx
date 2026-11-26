import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RowMenu } from './RowMenu';

describe('RowMenu', () => {
  it('menu gắn thẳng vào body (không lệch theo transform của phần tử cha); Hủy nằm ngoài role=menu', () => {
    const { container } = render(
      <div style={{ transform: 'translateY(24px)' }}>
        <RowMenu label="Thao tác cho A" items={[{ label: 'Sửa…', onSelect: () => {} }]} />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Thao tác cho A' }));
    const menu = screen.getByRole('menu', { name: 'Thao tác cho A' });
    expect(container.contains(menu)).toBe(false);
    expect(within(menu).queryByRole('button', { name: 'Hủy' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeInTheDocument();
  });

  it('Tab đóng menu và đưa focus về nút ⋯ để Tab đi tiếp từ đó (menu nằm cuối body)', () => {
    render(<RowMenu label="Thao tác cho A" items={[{ label: 'Sửa…', onSelect: () => {} }]} />);
    const btn = screen.getByRole('button', { name: 'Thao tác cho A' });
    fireEvent.click(btn);
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Sửa…' }), { key: 'Tab' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(btn).toHaveFocus();
  });
});
