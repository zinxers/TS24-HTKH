'use client';

import { useEffect, useId, useRef } from 'react';

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

/** Hộp thoại xác nhận cho mọi thao tác thay đổi dữ liệu. Esc = Hủy; mở ra thì focus nút Hủy. */
export function ConfirmDialog(props: ConfirmDialogProps) {
  if (!props.open) return null;
  return <OpenDialog {...props} />;
}

function OpenDialog({ title, message, confirmLabel, danger, busy, onConfirm, onCancel }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    cancelRef.current!.focus();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="confirm"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h2 id={titleId}>{title}</h2>
      <p>{message}</p>
      <div className="actions">
        <button ref={cancelRef} type="button" className="secondary" onClick={onCancel} disabled={busy}>
          Hủy
        </button>
        <button
          type="button"
          className={danger ? 'danger' : 'primary'}
          onClick={onConfirm}
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? 'Đang xử lý…' : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
