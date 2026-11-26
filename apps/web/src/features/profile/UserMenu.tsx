'use client';

import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { usePopover } from '../../components/usePopover';
import { apiClient } from '../../lib/api-client';
import { useCurrentUser } from '../../lib/current-user';
import { LogoutButton } from './LogoutButton';
import { ROLE_LABEL } from '../accounts/labels';
import { useConfirmAction } from '../accounts/useConfirmAction';
import { ProfileDialog } from './ProfileDialog';

const WIDTH = 260;

function initials(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  return ((words[0]?.[0] ?? '') + (words.length > 1 ? (words.at(-1)?.[0] ?? '') : '')).toUpperCase();
}

/** Avatar + họ tên (thu gọn: chỉ avatar) trong chân thanh bên; mở menu Sửa họ tên / Đăng xuất. Người dùng lấy từ context. */
export function UserMenu() {
  const { me: user, setMe, setNotice } = useCurrentUser();
  const { pos, triggerRef, menuRef, open, toggle, close, onKeyDown } = usePopover(WIDTH);
  const [editing, setEditing] = useState(false);
  const metaId = useId();
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
        <span className="who-text">
          <span className="name">{user.fullName}</span>
          <span className="role">{ROLE_LABEL[user.role]}</span>
        </span>
        <span className="caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {pos &&
        createPortal(
          <div ref={menuRef} className="popover user" style={pos} onKeyDown={onKeyDown}>
            <div className="items">
              <div className="meta" id={metaId}>
                <b>{user.fullName}</b>
                {ROLE_LABEL[user.role]} · {user.email}
              </div>
              <div role="menu" aria-label="Tài khoản" aria-describedby={metaId}>
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
                    setNotice(message);
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
                setMe(updated);
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
