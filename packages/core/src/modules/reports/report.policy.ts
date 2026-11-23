import type { CurrentUser, ReportScope } from '@ts24-htkh/shared';
import { ForbiddenError } from '../../errors';
import { canReport, type ReportAction } from '../../policies/permissions';

const MSG: Record<ReportAction, string> = {
  'report.view': 'Bạn không có quyền xem báo cáo',
  'report.note.edit': 'Bạn không có quyền sửa nội dung này',
};

export const ReportPolicy = {
  /** Chặn Nhân viên trước khi kiểm team tồn tại, để không lộ team nào có thật. */
  assertNotStaff(actor: CurrentUser, action: ReportAction): void {
    if (actor.role === 'staff') throw new ForbiddenError(MSG[action]);
  },
  assert(actor: CurrentUser, action: ReportAction, scope: ReportScope): void {
    if (!canReport(actor, action, scope)) throw new ForbiddenError(MSG[action]);
  },
};
