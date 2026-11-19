'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

export interface RowMenuItem {
  label: string;
  destructive?: boolean;
  onSelect: () => void;
}

const WIDTH = 200;

/**
 * Nút ⋯ mở menu thao tác của một dòng: desktop là menu kéo xuống, mobile là action sheet (CSS).
 * Esc đóng và trả focus về nút; mũi tên lên/xuống chuyển mục; bấm ra ngoài hoặc cuộn trang thì đóng.
 */
export function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = pos !== null;

  useEffect(() => {
    if (!open) return;
    menuRef.current!.querySelector<HTMLElement>('[role=menuitem]')?.focus();
    const dismiss = (e: Event) => {
      if (!menuRef.current?.contains(e.target as Node) && !triggerRef.current?.contains(e.target as Node)) setPos(null);
    };
    const onScroll = () => setPos(null);
    document.addEventListener('pointerdown', dismiss);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  function close() {
    setPos(null);
    triggerRef.current?.focus();
  }

  function toggle() {
    if (open) return close();
    const r = triggerRef.current!.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: Math.max(8, r.right - WIDTH) });
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      return close();
    }
    if (e.key === 'Tab') return setPos(null);
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const all = [...menuRef.current!.querySelectorAll<HTMLElement>('[role=menuitem]')];
    const i = all.indexOf(document.activeElement as HTMLElement);
    all[(i + (e.key === 'ArrowDown' ? 1 : all.length - 1)) % all.length]?.focus();
  }

  return (
    <>
      <button
        ref={triggerRef}
        className="icon-btn"
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {pos && (
        <div ref={menuRef} className="popover" role="menu" aria-label={label} style={pos} onKeyDown={onKeyDown}>
          <div className="items">
            {items.map((item) => (
              <button
                key={item.label}
                role="menuitem"
                type="button"
                className={item.destructive ? 'destructive' : undefined}
                onClick={() => {
                  // Focus về nút ⋯ trước khi mở hộp thoại để đóng hộp thoại thì focus quay lại đây.
                  close();
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button type="button" className="cancel" onClick={close}>
            Hủy
          </button>
        </div>
      )}
    </>
  );
}
