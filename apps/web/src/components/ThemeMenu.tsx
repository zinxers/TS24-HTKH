'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { applyTheme, currentTheme, type ThemeChoice } from '../lib/theme';
import { usePopover } from './usePopover';

const WIDTH = 200;

const svg = { viewBox: '0 0 24 24', width: 20, height: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 2, 'aria-hidden': true } as const;

const ICON: Record<ThemeChoice, ReactElement> = {
  light: (
    <svg {...svg} strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
  dark: (
    <svg {...svg} strokeLinejoin="round">
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </svg>
  ),
  system: (
    <svg {...svg} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  ),
};

const OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: 'Theo hệ thống' },
  { value: 'light', label: 'Sáng' },
  { value: 'dark', label: 'Tối' },
];

/** Nút chọn giao diện Sáng/Tối/Theo hệ thống trên thanh trên; lưu cookie theo thiết bị. */
export function ThemeMenu() {
  const { pos, triggerRef, menuRef, open, toggle, close, onKeyDown } = usePopover(WIDTH);
  // Khởi đầu 'system' rồi đọc thật sau khi mount để HTML server và client khớp nhau.
  const [choice, setChoice] = useState<ThemeChoice>('system');
  useEffect(() => setChoice(currentTheme()), []);

  const current = OPTIONS.find((o) => o.value === choice)!;

  return (
    <>
      <button
        ref={triggerRef}
        className="icon-btn theme-btn"
        type="button"
        aria-label="Giao diện"
        title={`Giao diện: ${current.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        {ICON[choice]}
      </button>
      {pos &&
        createPortal(
          <div ref={menuRef} className="popover theme" style={pos} onKeyDown={onKeyDown}>
            <div className="items" role="menu" aria-label="Giao diện">
              {OPTIONS.map((o) => (
                <button
                  key={o.value}
                  role="menuitemradio"
                  type="button"
                  aria-checked={o.value === choice}
                  onClick={() => {
                    applyTheme(o.value);
                    setChoice(o.value);
                    close();
                  }}
                >
                  <span className="tick" aria-hidden="true">
                    ✓
                  </span>
                  {o.label}
                </button>
              ))}
            </div>
            <button type="button" className="cancel" onClick={close}>
              Hủy
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
