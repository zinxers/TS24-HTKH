'use client';

import type { AccountView, CurrentUser, Team } from '@ts24-htkh/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AppBar } from '../../components/AppBar';
import { UserMenu } from '../profile/UserMenu';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ApiError, apiClient } from '../../lib/api-client';
import { CreateAccountDialog, EditAccountDialog, PasswordDialog, TransferDialog } from './AccountDialogs';
import { ROLE_LABEL, STATUS_LABEL, errorMessage } from './labels';
import { RowMenu, type RowMenuItem } from './RowMenu';
import { useConfirmAction } from './useConfirmAction';

type Form =
  | { kind: 'create' }
  | { kind: 'edit'; account: AccountView }
  | { kind: 'password'; account: AccountView }
  | { kind: 'transfer' };

const who = (a: AccountView) => `${a.fullName} (${a.email})`;

/** Màn hình quản lý tài khoản. Ẩn/hiện nút chỉ là gợi ý; API mới là luật. */
export function AccountsScreen() {
  const router = useRouter();
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [accounts, setAccounts] = useState<AccountView[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  // Xóa cookie cũ trước, nếu không proxy sẽ đưa /login về lại trang này.
  const leave = useCallback(async () => {
    try {
      await apiClient.auth.logout();
    } catch (e) {
      setNotice(errorMessage(e));
      return;
    }
    router.replace('/login');
  }, [router]);

  const action = useConfirmAction(() => void leave());

  useEffect(() => {
    Promise.all([apiClient.auth.me(), apiClient.accounts.list(), apiClient.teams.list()]).then(
      ([user, list, teamList]) => {
        setMe(user);
        setAccounts(list);
        setTeams(teamList);
      },
      (e: unknown) => {
        if (e instanceof ApiError && e.status === 401) void leave();
        else setLoadError(errorMessage(e));
      },
    );
  }, [leave]);

  const reload = async () => setAccounts(await apiClient.accounts.list());
  // Khóa/mở khóa xong: nháy nền dòng đó một lần để mắt bắt được thay đổi.
  const changeStatus = async (a: AccountView, status: AccountView['status']) => {
    await apiClient.accounts.setStatus(a.id, status);
    await reload();
    setFlashId(a.id);
  };
  const done = async () => {
    setForm(null);
    await reload();
  };

  if (!me) {
    return (
      <>
        <AppBar />
        <main className="content wide">
          <Link className="back" href="/">
            ‹ Trang chủ
          </Link>
          {loadError ? <p role="alert">{loadError}</p> : <p aria-busy="true">Đang tải…</p>}
        </main>
      </>
    );
  }

  const head = me.role === 'head';
  const ownStaff = (a: AccountView) => me.role === 'manager' && a.role === 'staff' && a.teamId === me.teamId;
  const canEdit = (a: AccountView) => head || ownStaff(a);
  const canManage = (a: AccountView) => a.id !== me.id && a.role !== 'head' && (head || ownStaff(a));
  const common = { error: action.error, busy: action.busy, onCancel: () => setForm(null) };
  const banner = form ? null : (action.error ?? notice);

  return (
    <>
      <AppBar
        userMenu={
          <UserMenu />
        }
      />
      <main className="content wide">
        <Link className="back" href="/">
          ‹ Trang chủ
        </Link>
        <div className="page-head">
          <div>
            <h1>Quản lý tài khoản</h1>
            <p className="count">{accounts.length} tài khoản</p>
          </div>
          <div className="page-actions">
            {head && (
              <button className="btn btn-secondary" type="button" onClick={() => setForm({ kind: 'transfer' })}>
                Bàn giao Trưởng phòng
              </button>
            )}
            <button className="btn btn-primary" type="button" onClick={() => setForm({ kind: 'create' })}>
              Tạo tài khoản
            </button>
          </div>
        </div>
        {banner && (
          <p role="alert" className="banner-error">
            {banner}
          </p>
        )}
        <div className="table-wrap">
          <table className="accounts-table">
            <colgroup>
              <col className="c-name" />
              <col className="c-email" />
              <col className="c-role" />
              <col className="c-team" />
              <col className="c-status" />
              <col className="c-actions" />
            </colgroup>
            <thead>
              <tr>
                <th>Họ tên</th>
                <th>Email</th>
                <th>Vai trò</th>
                <th>Team</th>
                <th>Trạng thái</th>
                <th>
                  <span className="visually-hidden">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => {
                const locked = a.status === 'locked';
                const items: RowMenuItem[] = [];
                if (canEdit(a)) items.push({ label: 'Sửa…', onSelect: () => setForm({ kind: 'edit', account: a }) });
                if (canManage(a)) {
                  items.push(
                    { label: 'Đặt mật khẩu…', onSelect: () => setForm({ kind: 'password', account: a }) },
                    locked
                      ? {
                          label: 'Mở khóa',
                          onSelect: () =>
                            action.ask({
                              title: 'Mở khóa tài khoản?',
                              message: `${who(a)} đăng nhập lại được.`,
                              confirmLabel: 'Mở khóa',
                              run: () => changeStatus(a, 'active'),
                            }),
                        }
                      : {
                          label: 'Khóa…',
                          onSelect: () =>
                            action.ask({
                              title: 'Khóa tài khoản?',
                              message: `${who(a)} bị đăng xuất ngay và không đăng nhập được cho tới khi mở khóa.`,
                              confirmLabel: 'Khóa',
                              danger: true,
                              run: () => changeStatus(a, 'locked'),
                            }),
                        },
                    {
                      label: 'Xóa…',
                      destructive: true,
                      onSelect: () =>
                        action.ask({
                          title: 'Xóa tài khoản?',
                          message: `${who(a)} bị đăng xuất và không còn trong danh sách. Báo cáo đã gửi vẫn giữ nguyên.`,
                          confirmLabel: 'Xóa',
                          danger: true,
                          run: async () => {
                            await apiClient.accounts.remove(a.id);
                            await reload();
                          },
                        }),
                    },
                  );
                }
                const team = a.teamName ? ` · ${a.teamName}` : '';
                return (
                  <tr
                    key={a.id}
                    className={[locked && 'is-locked', flashId === a.id && 'flash'].filter(Boolean).join(' ') || undefined}
                    onAnimationEnd={() => setFlashId(null)}
                  >
                    <td className="cell-name">
                      <span className="name">{a.fullName}</span>
                      {a.id === me.id && <span className="me"> (bạn)</span>}
                      <span className="sub">
                        {a.email}
                        <br />
                        {ROLE_LABEL[a.role]}
                        {team}
                      </span>
                    </td>
                    <td>{a.email}</td>
                    <td>{ROLE_LABEL[a.role]}</td>
                    <td>{a.teamName ?? '—'}</td>
                    <td className="status">{locked && <span className="state-locked">{STATUS_LABEL.locked}</span>}</td>
                    <td className="actions">
                      {items.length > 0 && <RowMenu label={`Thao tác cho ${a.fullName}`} items={items} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>

      {form?.kind === 'create' && (
        <CreateAccountDialog
          me={me}
          teams={teams}
          {...common}
          onSubmit={(input) =>
            action.ask({
              title: 'Xác nhận tạo tài khoản',
              message: `Tạo tài khoản ${input.fullName} (${input.email}) với vai trò ${ROLE_LABEL[input.role]}?`,
              confirmLabel: 'Tạo',
              run: async () => {
                await apiClient.accounts.create(input);
                await done();
              },
            })
          }
        />
      )}
      {form?.kind === 'edit' && (
        <EditAccountDialog
          me={me}
          teams={teams}
          account={form.account}
          {...common}
          onSubmit={(input) => {
            if (Object.keys(input).length === 0) return setForm(null);
            action.ask({
              title: 'Lưu thay đổi',
              message: `Lưu thay đổi cho ${who(form.account)}?${input.role || input.teamId ? ' Đổi vai trò hoặc team sẽ đăng xuất người này.' : ''}`,
              confirmLabel: 'Lưu',
              run: async () => {
                await apiClient.accounts.update(form.account.id, input);
                await done();
              },
            });
          }}
        />
      )}
      {form?.kind === 'password' && (
        <PasswordDialog
          account={form.account}
          {...common}
          onSubmit={(password) =>
            action.ask({
              title: 'Đặt mật khẩu',
              message: `Đặt mật khẩu mới cho ${who(form.account)}?`,
              confirmLabel: 'Đặt mật khẩu',
              run: async () => {
                await apiClient.accounts.setPassword(form.account.id, password);
                setForm(null);
              },
            })
          }
        />
      )}
      {form?.kind === 'transfer' && (
        <TransferDialog
          me={me}
          teams={teams}
          accounts={accounts}
          {...common}
          onSubmit={(input) => {
            const to = accounts.find((a) => a.id === input.toUserId);
            action.ask({
              title: 'Bàn giao Trưởng phòng',
              message: `Bàn giao vai trò Trưởng phòng cho ${to ? who(to) : ''}? Bạn trở thành ${ROLE_LABEL[input.newRole]} và cả hai bị đăng xuất ngay.`,
              confirmLabel: 'Bàn giao',
              danger: true,
              run: async () => {
                await apiClient.accounts.transferHead(input);
                await leave();
              },
            });
          }}
        />
      )}
      <ConfirmDialog {...action.dialogProps} />
    </>
  );
}
