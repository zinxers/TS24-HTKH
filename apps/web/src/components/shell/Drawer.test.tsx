import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Drawer } from './Drawer';

describe('Drawer', () => {
  it('open mở dialog, open=false đóng lại', () => {
    const { container, rerender } = render(<Drawer open onClose={() => {}}>x</Drawer>);
    const dlg = container.querySelector('dialog')!;
    expect(dlg).toHaveAttribute('open');
    expect(dlg).toHaveAttribute('aria-label', 'Điều hướng');
    rerender(<Drawer open={false} onClose={() => {}}>x</Drawer>);
    expect(dlg).not.toHaveAttribute('open');
  });

  it('cancel (Esc) gọi onClose một lần', () => {
    const onClose = vi.fn();
    const { container } = render(<Drawer open onClose={onClose}>x</Drawer>);
    fireEvent(container.querySelector('dialog')!, new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('bấm vùng nền ngoài khung gọi onClose; bấm trong khung thì không', () => {
    const onClose = vi.fn();
    const { container, getByText } = render(<Drawer open onClose={onClose}><p>nội dung</p></Drawer>);
    fireEvent.click(getByText('nội dung'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector('dialog')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
