import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

function setup(props: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog
      open
      title="Khóa tài khoản"
      message="Khóa tài khoản của A?"
      confirmLabel="Khóa"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onConfirm, onCancel };
}

describe('ConfirmDialog', () => {
  it('hiện tiêu đề, nội dung; focus nút Hủy khi mở', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Khóa tài khoản' })).toBeInTheDocument();
    expect(screen.getByText('Khóa tài khoản của A?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hủy' })).toHaveFocus();
  });

  it('bấm Xác nhận gọi onConfirm', () => {
    const { onConfirm } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Khóa' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('busy: nút xác nhận và Hủy bị khóa', () => {
    const { onConfirm } = setup({ busy: true });
    const confirm = screen.getByRole('button', { name: 'Đang xử lý…' });
    expect(confirm).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeDisabled();
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Esc (sự kiện cancel của dialog) và nút Hủy gọi onCancel', () => {
    const { onCancel } = setup();
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('đang mở rồi đóng (không có animation) thì gỡ ngay', () => {
    const props = { title: 'T', message: 'M', confirmLabel: 'OK', onConfirm: vi.fn(), onCancel: vi.fn() };
    const { rerender } = render(<ConfirmDialog open {...props} />);
    rerender(<ConfirmDialog open={false} {...props} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('đóng xong trả focus về phần tử đã mở hộp thoại, kể cả khi nút bị khóa lúc đang xử lý', () => {
    const props = { title: 'T', message: 'M', confirmLabel: 'OK', onConfirm: vi.fn(), onCancel: vi.fn() };
    const { rerender } = render(
      <>
        <button type="button">Mở</button>
        <ConfirmDialog open={false} {...props} />
      </>,
    );
    const opener = screen.getByRole('button', { name: 'Mở' });
    opener.focus();
    rerender(
      <>
        <button type="button">Mở</button>
        <ConfirmDialog open busy {...props} />
      </>,
    );
    (document.activeElement as HTMLElement).blur();
    rerender(
      <>
        <button type="button">Mở</button>
        <ConfirmDialog open={false} {...props} />
      </>,
    );
    expect(opener).toHaveFocus();
  });

  it('đóng thì không hiện', () => {
    setup({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
