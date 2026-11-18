export type Role = 'head' | 'manager' | 'staff';

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  teamId: string | null;
}
