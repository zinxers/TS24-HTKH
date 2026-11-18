export type Role = 'head' | 'manager' | 'staff';

/** Tên cookie phiên: API đặt/đọc, proxy giao diện chỉ kiểm có/không. */
export const SESSION_COOKIE = '__Host-ts24-htkh-session';

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  teamId: string | null;
}
