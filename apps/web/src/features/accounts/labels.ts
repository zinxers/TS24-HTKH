import type { AccountStatus, Role } from '@ts24-htkh/shared';
import { ApiError } from '../../lib/api-client';

export const ROLE_LABEL: Record<Role, string> = { head: 'Trưởng phòng', manager: 'Quản lý', staff: 'Nhân Viên' };
export const STATUS_LABEL: Record<AccountStatus, string> = { active: 'Hoạt động', locked: 'Đã khóa' };

export const errorMessage = (e: unknown) =>
  e instanceof ApiError ? e.message : 'Lỗi hệ thống, vui lòng thử lại';
