'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { animateOut } from './animate-out';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Hộp thoại xác nhận cho mọi thao tác thay đổi dữ liệu. Esc = Hủy; mở ra thì focus nút Hủy. Đóng có animation. */
export function ConfirmDialog(props: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(props.open);
  const onExited = useCallback(() => setMounted(false), []);
  // Giữ nội dung lần mở cuối để lúc animation đóng không bị trống chữ.
  const last = useRef(props);
  if (props.open) last.current = props;
  if (props.open && !mounted) setMounted(true);
  if (!mounted) return null;
  return <OpenDialog {...last.current} open={props.open} onExited={onExited} />;
}

function OpenDialog({
  open,
  title,
  message,
  confirmLabel,
  danger,
  busy,
  onConfirm,
  onCancel,
  onExited,
}: ConfirmDialogProps & { onExited: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current!;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    cancelRef.current!.focus();
    return () => {
      dialog.close();
      // Nút xác nhận bị khóa lúc đang xử lý làm mất focus; đóng xong đưa focus về chỗ đã mở.
      const lost = document.activeElement === document.body || dialog.contains(document.activeElement);
      if (lost && opener?.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    // Mở lại khi đang chạy animation đóng: bỏ class để hộp thoại hiện lại bình thường.
    if (open) ref.current!.classList.remove('closing');
    else animateOut(ref.current!, onExited);
  }, [open, onExited]);

  return (
    <dialog
      ref={ref}
      className="confirm"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy && open) onCancel();
      }}
    >
      <h2 id={titleId}>{title}</h2>
      <p>{message}</p>
      <div className="actions">
        <button ref={cancelRef} type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy || !open}>
          Hủy
        </button>
        <button
          type="button"
          className={danger ? 'btn btn-danger' : 'btn btn-primary'}
          onClick={onConfirm}
          disabled={busy || !open}
          aria-busy={busy}
        >
          {busy ? 'Đang xử lý…' : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
