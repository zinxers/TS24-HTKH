import type { CurrentUser } from '@ts24-htkh/shared';
import { describe, expect, it } from 'vitest';
import { ForbiddenError } from '../../errors';
import { ReportPolicy } from './report.policy';

const user = (role: CurrentUser['role'], teamId: string | null): CurrentUser => ({
  id: role,
  email: `${role}@example.com`,
  fullName: role,
  role,
  teamId,
});

describe('ReportPolicy', () => {
  it('Nhân viên bị chặn trước, thông báo theo action', () => {
    expect(() => ReportPolicy.assertNotStaff(user('staff', 'a'), 'report.view')).toThrow(
      new ForbiddenError('Bạn không có quyền xem báo cáo'),
    );
    expect(() => ReportPolicy.assertNotStaff(user('staff', 'a'), 'report.note.edit')).toThrow(
      'Bạn không có quyền sửa nội dung này',
    );
    expect(() => ReportPolicy.assertNotStaff(user('manager', 'a'), 'report.view')).not.toThrow();
  });

  it('Quản lý ngoài phạm vi bị chặn, trong phạm vi được', () => {
    const m = user('manager', 'a');
    expect(() => ReportPolicy.assert(m, 'report.note.edit', 'dept')).toThrow(ForbiddenError);
    expect(() => ReportPolicy.assert(m, 'report.note.edit', 'b')).toThrow(ForbiddenError);
    expect(() => ReportPolicy.assert(m, 'report.note.edit', 'a')).not.toThrow();
    expect(() => ReportPolicy.assert(user('head', null), 'report.view', 'dept')).not.toThrow();
  });
});
