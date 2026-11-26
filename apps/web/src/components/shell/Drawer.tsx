'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

// <dialog> modal: focus trap, Esc và trả focus về nút ☰ do trình duyệt lo.
export function Drawer({ open, onClose, children }: DrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    else if (!open && dlg.open) dlg.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="drawer"
      aria-label="Điều hướng"
      onCancel={(e) => {
        e.preventDefault(); // để React điều khiển qua prop open
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(); // bấm nền ::backdrop
      }}
    >
      {children}
    </dialog>
  );
}
