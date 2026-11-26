'use client';

import { createPortal } from 'react-dom';
import { usePopover } from '../../components/usePopover';

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
  const { pos, triggerRef, menuRef, open, toggle, close, onKeyDown } = usePopover(WIDTH);

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
      {pos &&
        // Portal ra body: phần tử cha đang chạy hiệu ứng `transform` (motion.css) làm lệch menu position:fixed.
        createPortal(
          <div ref={menuRef} className="popover" style={pos} onKeyDown={onKeyDown}>
            <div className="items" role="menu" aria-label={label}>
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
          </div>,
          document.body,
        )}
    </>
  );
}
