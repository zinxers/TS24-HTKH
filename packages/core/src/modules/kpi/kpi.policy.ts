import type { CurrentUser } from '@ts24-htkh/shared';
import { ForbiddenError } from '../../errors';
import { canKpi, type KpiAction } from '../../policies/permissions';
import { MSG_FORBIDDEN } from '../accounts/account.policy';

const MSG_RATE = 'Chỉ Trưởng phòng được đổi đơn giá';

export const KpiPolicy = {
  assert(actor: CurrentUser, action: KpiAction): void {
    if (!canKpi(actor, action)) throw new ForbiddenError(action === 'rate.set' ? MSG_RATE : MSG_FORBIDDEN);
  },
};
