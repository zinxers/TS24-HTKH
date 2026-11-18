import type { CurrentUser, Role } from '@ts24-htkh/shared';

export type AccountAction =
  | 'account.list'
  | 'account.create'
  | 'account.update'
  | 'account.lock'
  | 'account.unlock'
  | 'account.delete'
  | 'account.set_password'
  | 'account.transfer_head'
  | 'profile.update';

export interface AccountTarget {
  id: string;
  role: Role;
  teamId: string | null;
}

/** Giá trị mới gửi lên (create: vai trò, team của tài khoản mới; update: trường muốn đổi). */
export interface AccountChange {
  role?: Role;
  teamId?: string | null;
}

/** Quản lý chỉ tác động Nhân Viên team mình. */
const isOwnStaff = (actor: CurrentUser, target: AccountTarget) =>
  actor.role === 'manager' && target.role === 'staff' && target.teamId === actor.teamId;

/** Phạm vi xem: Trưởng phòng thấy hết; người khác thấy chính mình, Quản lý thêm Nhân Viên team mình. */
export function canSee(actor: CurrentUser, target: AccountTarget): boolean {
  return actor.role === 'head' || target.id === actor.id || isOwnStaff(actor, target);
}

/** Ma trận quyền theo bảng Quyền của spec Mốc 3. Hàm thuần: chỉ trả lời có/không. */
export function can(
  actor: CurrentUser,
  action: AccountAction,
  target?: AccountTarget,
  change: AccountChange = {},
): boolean {
  switch (action) {
    case 'profile.update':
      return true;
    case 'account.list':
      return actor.role !== 'staff';
    case 'account.transfer_head':
      return actor.role === 'head';
    case 'account.create':
      if (change.role === 'head') return false;
      if (actor.role === 'head') return true;
      return actor.role === 'manager' && change.role === 'staff' && change.teamId === actor.teamId;
    default:
      break;
  }
  if (!target) return false;

  if (action === 'account.update') {
    const roleChanged = change.role !== undefined && change.role !== target.role;
    const teamChanged = change.teamId !== undefined && change.teamId !== target.teamId;
    if (change.role === 'head' && roleChanged) return false;
    if (actor.role === 'head') return target.id !== actor.id || (!roleChanged && !teamChanged);
    return isOwnStaff(actor, target) && !roleChanged && !teamChanged;
  }

  // lock, unlock, delete, set_password: không ai tác động chính mình hay Trưởng phòng.
  if (target.id === actor.id || target.role === 'head') return false;
  return actor.role === 'head' || isOwnStaff(actor, target);
}
