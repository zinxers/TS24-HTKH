import type { AccountStatus, Role } from '@ts24-htkh/shared';

export const ROLE_LABEL: Record<Role, string> = { head: 'Trưởng phòng', manager: 'Quản lý', staff: 'Nhân Viên' };
export const STATUS_LABEL: Record<AccountStatus, string> = { active: 'Hoạt động', locked: 'Đã khóa' };

export { errorMessage } from '../../lib/errors';
