'use client';

import type { CurrentUser } from '@ts24-htkh/shared';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { usePopover } from '../../components/usePopover';
import { apiClient } from '../../lib/api-client';
import { LogoutButton } from '../auth/LogoutButton';
import { ProfileDialog } from './AccountDialogs';
import { ROLE_LABEL } from './labels';
import { useConfirmAction } from './useConfirmAction';

const WIDTH = 260;

function initials(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  return ((words[0]?.[0] ?? '') + (words.length > 1 ? (words.at(-1)?.[0] ?? '') : '')).toUpperCase();
}

/** Avatar + họ tên trên thanh trên; mở menu Sửa họ tên / Đăng xuất cho mọi vai trò. */
export function UserMenu({
  user: given,
  onUserChange,
  onLogoutError,
}: {
  user: CurrentUser;
  onUserChange?: (user: CurrentUser) => void;
  onLogoutError: (message: string | null) => void;
}) {
  const { pos, triggerRef, menuRef, open, toggle, close, onKeyDown } = usePopover(WIDTH);
  const [editing, setEditing] = useState(false);
  // Màn hình không truyền onUserChange vẫn thấy tên mới trên thanh trên.
  const [renamed, setRenamed] = useState<CurrentUser | null>(null);
  // Màn hình đưa user mới (vd sau onUserChange) thì dùng cái đó, bỏ bản tạm.
  useEffect(() => setRenamed(null), [given]);
  const user = renamed?.id === given.id ? renamed : given;
  // Hết phiên khi sửa: tải lại trang để màn hình chạy luồng 401 của nó.
  const action = useConfirmAction(() => window.location.reload());

  return (
    <>
      <button
        ref={triggerRef}
        className="who-btn"
        type="button"
        aria-label={`Tài khoản ${user.fullName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <span className="avatar" aria-hidden="true">
          {initials(user.fullName)}
        </span>
        <span className="name">{user.fullName}</span>
        <span className="caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {pos &&
        createPortal(
          <div ref={menuRef} className="popover user" style={pos} onKeyDown={onKeyDown}>
            <div className="items">
              <div className="meta">
                <b>{user.fullName}</b>
                {ROLE_LABEL[user.role]} · {user.email}
              </div>
              <div role="menu" aria-label="Tài khoản">
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    close();
                    setEditing(true);
                  }}
                >
                  Sửa họ tên
                </button>
                <LogoutButton
                  role="menuitem"
                  className=""
                  onError={(message) => {
                    // Nút đang khóa mất focus: lỗi thì đóng menu, focus về nút avatar, thông báo hiện trên màn hình.
                    if (message) close();
                    onLogoutError(message);
                  }}
                />
              </div>
            </div>
            <button type="button" className="cancel" onClick={close}>
              Hủy
            </button>
          </div>,
          document.body,
        )}
      {editing && (
        <ProfileDialog
          fullName={user.fullName}
          error={action.error}
          busy={action.busy}
          onCancel={() => setEditing(false)}
          onSubmit={(fullName) =>
            action.ask({
              title: 'Sửa họ tên',
              message: `Đổi họ tên thành “${fullName.trim()}”?`,
              confirmLabel: 'Lưu',
              run: async () => {
                const updated = await apiClient.me.updateProfile(fullName);
                setRenamed(updated);
                onUserChange?.(updated);
                setEditing(false);
              },
            })
          }
        />
      )}
      <ConfirmDialog {...action.dialogProps} />
    </>
  );
}
