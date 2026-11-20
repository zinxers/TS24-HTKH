import type { CurrentUser } from '@ts24-htkh/shared';
import { ForbiddenError } from '../../errors';
import { canTeamKpi, type TeamKpiAction } from '../../policies/permissions';

const MSG: Record<TeamKpiAction, string> = {
  'team.kpi.view': 'Bạn không có quyền xem báo cáo team',
  'dept.kpi.view': 'Chỉ Trưởng phòng được xem tổng quan phòng',
};

export const TeamKpiPolicy = {
  /** Chặn Nhân viên trước khi kiểm team tồn tại, để không lộ team nào có thật. */
  assertNotStaff(actor: CurrentUser, action: TeamKpiAction): void {
    if (actor.role === 'staff') throw new ForbiddenError(MSG[action]);
  },
  assert(actor: CurrentUser, action: TeamKpiAction, teamId?: string): void {
    if (!canTeamKpi(actor, action, teamId)) throw new ForbiddenError(MSG[action]);
  },
};
