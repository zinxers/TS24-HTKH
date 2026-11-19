import type { CurrentUser } from '@ts24-htkh/shared';
import { ForbiddenError, NotFoundError } from '../../errors';
import { can, canSee, type AccountAction, type AccountChange, type AccountTarget } from '../../policies/permissions';

export const MSG_FORBIDDEN = 'Bạn không có quyền thực hiện thao tác này';
export const MSG_NOT_FOUND = 'Không tìm thấy tài khoản';

export const AccountPolicy = {
  /** Đích ngoài phạm vi xem → 404 (không lộ tài khoản team khác). */
  assertVisible(actor: CurrentUser, target: AccountTarget | null): void {
    if (!target || !canSee(actor, target)) throw new NotFoundError(MSG_NOT_FOUND);
  },

  assert(actor: CurrentUser, action: AccountAction, target?: AccountTarget, change?: AccountChange): void {
    if (!can(actor, action, target, change)) throw new ForbiddenError(MSG_FORBIDDEN);
  },
};
