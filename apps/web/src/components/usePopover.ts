import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

/**
 * Trạng thái menu kéo xuống: Esc đóng và trả focus về nút; mũi tên lên/xuống chuyển mục
 * `[role^=menuitem]`; Tab, bấm ra ngoài, cuộn hoặc đổi cỡ cửa sổ thì đóng.
 */
export function usePopover(width: number) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = pos !== null;

  useEffect(() => {
    if (!open) return;
    menuRef.current!.querySelector<HTMLElement>('[role^=menuitem]')?.focus();
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
    setPos({ top: r.bottom + 4, left: Math.max(8, r.right - width) });
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      return close();
    }
    if (e.key === 'Tab') return setPos(null);
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const all = [...menuRef.current!.querySelectorAll<HTMLElement>('[role^=menuitem]')];
    const i = all.indexOf(document.activeElement as HTMLElement);
    all[(i + (e.key === 'ArrowDown' ? 1 : all.length - 1)) % all.length]?.focus();
  }

  return { open, pos, triggerRef, menuRef, toggle, close, onKeyDown };
}
