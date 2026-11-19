'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { animateOut } from './animate-out';

/** Một ô trong form: label nối với control qua id. */
export function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
    </div>
  );
}

export interface FormDialogProps {
  title: string;
  submitLabel: string;
  hint?: string;
  error?: string | null;
  busy?: boolean;
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
  children: ReactNode;
}

/** Hộp thoại chứa form; gửi form chỉ chuyển sang bước xác nhận, không tự gọi API. Esc = Hủy. */
export function FormDialog({ title, submitLabel, hint, error, busy, onSubmit, onCancel, children }: FormDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  // Hủy: chạy animation đóng rồi mới báo ra ngoài để gỡ hộp thoại.
  const cancel = () => animateOut(ref.current!, onCancel);

  return (
    <dialog
      ref={ref}
      className="form-dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) cancel();
      }}
    >
      <h2 id={titleId}>{title}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(new FormData(e.currentTarget));
        }}
      >
        <div className="group">{children}</div>
        {hint && <p className="hint">{hint}</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <button type="button" className="btn btn-secondary" onClick={cancel} disabled={busy}>
            Hủy
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {submitLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
