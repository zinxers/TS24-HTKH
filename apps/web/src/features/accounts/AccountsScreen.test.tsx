import type { AccountView, CurrentUser } from '@ts24-htkh/shared';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient } from '../../lib/api-client';
import { renderWithUser } from '../../test/render-with-user';
import { AccountsScreen } from './AccountsScreen';

const A = 'team-a';
const B = 'team-b';
const MSG_FORBIDDEN = 'Bạn không có quyền thực hiện thao tác này';

const account = (id: string, fullName: string, role: AccountView['role'], teamId: string | null, status: AccountView['status'] = 'active'): AccountView => ({
  id,
  email: `${id}@example.com`,
  fullName,
  role,
  teamId,
  teamName: teamId === A ? 'Team A' : teamId === B ? 'Team B' : null,
  status,
  createdAt: '2026-11-18T00:00:00.000Z',
});

const H = account('h', 'Trưởng Phòng', 'head', null);
const M = account('m', 'Quản Lý', 'manager', A);
const SA = account('sa', 'Nhân Viên A', 'staff', A);
const SL = account('sl', 'Nhân Viên Khóa', 'staff', A, 'locked');
const asUser = (a: AccountView): CurrentUser => ({ id: a.id, email: a.email, fullName: a.fullName, role: a.role, teamId: a.teamId });

function setup(me: AccountView, accounts: AccountView[]) {
  const list = vi.spyOn(apiClient.accounts, 'list').mockResolvedValue(accounts);
  vi.spyOn(apiClient.teams, 'list').mockResolvedValue([
    { id: A, name: 'Team A', shortName: 'TA' },
    { id: B, name: 'Team B', shortName: 'TB' },
  ]);
  const { value } = renderWithUser(<AccountsScreen />, asUser(me));
  return { list, value };
}

const confirmDialog = () => screen.getAllByRole('dialog').at(-1)!;

/** Mở menu ⋯ của một dòng, trả về tên các mục rồi đóng menu. */
async function menuItems(fullName: string) {
  fireEvent.click(await screen.findByRole('button', { name: `Thao tác cho ${fullName}` }));
  const names = within(screen.getByRole('menu')).getAllByRole('menuitem').map((i) => i.textContent);
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
  return names;
}

/** Mở menu ⋯ của một dòng rồi chọn một mục. */
async function rowAction(fullName: string, item: string) {
  fireEvent.click(await screen.findByRole('button', { name: `Thao tác cho ${fullName}` }));
  fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: item }));
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('AccountsScreen: quyền gợi ý', () => {
  it('Nhân Viên (API 403) thấy thông báo không có quyền, không có bảng', async () => {
    vi.spyOn(apiClient.accounts, 'list').mockRejectedValue(new ApiError('FORBIDDEN', 403, MSG_FORBIDDEN));
    vi.spyOn(apiClient.teams, 'list').mockResolvedValue([]);
    renderWithUser(<AccountsScreen />, asUser(SA));
    expect(await screen.findByText(MSG_FORBIDDEN)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('Trưởng phòng: menu ⋯ dòng của mình chỉ có Sửa; dòng khác đủ mục; có nút Bàn giao', async () => {
    setup(H, [H, M, SA, SL]);
    expect(await menuItems('Trưởng Phòng')).toEqual(['Sửa…']);
    expect(await menuItems('Quản Lý')).toEqual(['Sửa…', 'Đặt mật khẩu…', 'Khóa…', 'Xóa…']);
    expect(await menuItems('Nhân Viên Khóa')).toEqual(['Sửa…', 'Đặt mật khẩu…', 'Mở khóa', 'Xóa…']);
    expect(screen.getByRole('button', { name: 'Bàn giao Trưởng phòng' })).toBeInTheDocument();
    expect(screen.getAllByText('Nhân Viên', { selector: 'td' })).toHaveLength(2);
    expect(screen.getByText('Đã khóa')).toBeInTheDocument();
  });

  it('Quản lý: không có nút ⋯ ở dòng của mình, không có Bàn giao', async () => {
    setup(M, [M, SA]);
    expect(await screen.findByRole('button', { name: 'Thao tác cho Nhân Viên A' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thao tác cho Quản Lý' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bàn giao Trưởng phòng' })).not.toBeInTheDocument();
  });

  it('menu ⋯: Esc đóng menu, trả focus về nút ⋯', async () => {
    setup(H, [H, SA]);
    const trigger = await screen.findByRole('button', { name: 'Thao tác cho Nhân Viên A' });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

describe('AccountsScreen: thao tác ghi qua ConfirmDialog', () => {
  it('Khóa: mở xác nhận trước, chỉ gọi API khi xác nhận, rồi tải lại', async () => {
    const { list } = setup(H, [H, SA]);
    const setStatus = vi.spyOn(apiClient.accounts, 'setStatus').mockResolvedValue({ ...SA, status: 'locked' });
    await rowAction('Nhân Viên A', 'Khóa…');
    expect(screen.getByRole('dialog', { name: 'Khóa tài khoản?' })).toBeInTheDocument();
    expect(setStatus).not.toHaveBeenCalled();
    fireEvent.click(within(confirmDialog()).getByRole('button', { name: 'Khóa' }));
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith('sa', 'locked'));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('lỗi API hiện đúng message', async () => {
    setup(H, [H, SA]);
    vi.spyOn(apiClient.accounts, 'remove').mockRejectedValue(new ApiError('NOT_FOUND', 404, 'Không tìm thấy tài khoản'));
    await rowAction('Nhân Viên A', 'Xóa…');
    fireEvent.click(within(confirmDialog()).getByRole('button', { name: 'Xóa' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tìm thấy tài khoản');
  });

  it('đang gửi: nút xác nhận bị khóa', async () => {
    setup(H, [H, SA]);
    vi.spyOn(apiClient.accounts, 'setStatus').mockReturnValue(new Promise(() => {}));
    await rowAction('Nhân Viên A', 'Khóa…');
    fireEvent.click(within(confirmDialog()).getByRole('button', { name: 'Khóa' }));
    expect(await screen.findByRole('button', { name: 'Đang xử lý…' })).toBeDisabled();
  });

  it('Tạo: form → xác nhận → API; email trùng hiện lỗi trong form', async () => {
    setup(H, [H]);
    const create = vi
      .spyOn(apiClient.accounts, 'create')
      .mockRejectedValue(new ApiError('CONFLICT', 409, 'Email đã có tài khoản'));
    fireEvent.click(await screen.findByRole('button', { name: 'Tạo tài khoản' }));
    const form = screen.getByRole('dialog', { name: 'Tạo tài khoản' });
    expect(within(form).getByLabelText('Mật khẩu')).toHaveAttribute('autocomplete', 'new-password');
    fireEvent.change(within(form).getByLabelText('Email'), { target: { value: 'moi@example.com' } });
    fireEvent.change(within(form).getByLabelText('Họ tên'), { target: { value: 'Người Mới' } });
    fireEvent.change(within(form).getByLabelText('Mật khẩu'), { target: { value: '12345678' } });
    fireEvent.submit(form.querySelector('form')!);
    expect(create).not.toHaveBeenCalled();
    fireEvent.click(within(confirmDialog()).getByRole('button', { name: 'Tạo' }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        email: 'moi@example.com',
        fullName: 'Người Mới',
        role: 'staff',
        teamId: A,
        password: '12345678',
      }),
    );
    expect(await within(form).findByRole('alert')).toHaveTextContent('Email đã có tài khoản');
  });

  it('Bàn giao xong → đăng xuất, về /login', async () => {
    const { value } = setup(H, [H, M, SA]);
    const transfer = vi.spyOn(apiClient.accounts, 'transferHead').mockResolvedValue();
    fireEvent.click(await screen.findByRole('button', { name: 'Bàn giao Trưởng phòng' }));
    const form = screen.getByRole('dialog', { name: 'Bàn giao Trưởng phòng' });
    fireEvent.change(within(form).getByLabelText('Người nhận'), { target: { value: 'm' } });
    fireEvent.submit(form.querySelector('form')!);
    fireEvent.click(within(confirmDialog()).getByRole('button', { name: 'Bàn giao' }));
    await waitFor(() => expect(transfer).toHaveBeenCalledWith({ toUserId: 'm', newRole: 'manager', newTeamId: A }));
    await waitFor(() => expect(value.leave).toHaveBeenCalled());
  });

  it('phiên hết (401) khi thao tác → đăng xuất, về /login', async () => {
    const { value } = setup(H, [H, SA]);
    vi.spyOn(apiClient.accounts, 'setStatus').mockRejectedValue(new ApiError('AUTH', 401, 'hết hạn'));
    await rowAction('Nhân Viên A', 'Khóa…');
    fireEvent.click(within(confirmDialog()).getByRole('button', { name: 'Khóa' }));
    await waitFor(() => expect(value.leave).toHaveBeenCalled());
  });
});

describe('AccountsScreen: tự sửa họ tên', () => {
  it('đổi họ tên trong context: dòng của mình trong bảng đổi ngay, không cần tải lại', async () => {
    const { value } = setup(H, [H, M]);
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Trưởng Phòng')).toBeInTheDocument();
    act(() => value.setMe({ ...asUser(H), fullName: 'Tên Mới' }));
    expect(await within(table).findByText('Tên Mới')).toBeInTheDocument();
    expect(within(table).queryByText('Trưởng Phòng')).not.toBeInTheDocument();
  });
});
