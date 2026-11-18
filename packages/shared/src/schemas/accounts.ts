import { z } from 'zod';
import type { Role } from '../auth';

const MSG_PASSWORD = 'Mật khẩu phải dài 8 đến 128 ký tự';

const fullName = z.string().trim().min(1).max(100);
const password = z.string().min(8, MSG_PASSWORD).max(128, MSG_PASSWORD);
const assignableRole = z.enum(['manager', 'staff']);

export const accountCreateSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  fullName,
  role: assignableRole,
  teamId: z.uuid(),
  password,
});

export const accountUpdateSchema = z
  .object({ fullName: fullName.optional(), role: assignableRole.optional(), teamId: z.uuid().optional() })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Không có gì để cập nhật' });

export const accountStatusSchema = z.object({ status: z.enum(['active', 'locked']) });

export const setPasswordSchema = z.object({ password });

/** Vai trò và team mới của Trưởng phòng hiện tại sau khi bàn giao. */
export const transferHeadSchema = z.object({
  toUserId: z.uuid(),
  newRole: assignableRole,
  newTeamId: z.uuid(),
});

export const profileUpdateSchema = z.object({ fullName });

export type AccountCreateInput = z.infer<typeof accountCreateSchema>;
export type AccountUpdateInput = z.infer<typeof accountUpdateSchema>;
export type AccountStatusInput = z.infer<typeof accountStatusSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
export type TransferHeadInput = z.infer<typeof transferHeadSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type AccountStatus = AccountStatusInput['status'];

/** Tài khoản trả cho giao diện: không có trường mật khẩu. */
export interface AccountView {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  teamId: string | null;
  teamName: string | null;
  status: AccountStatus;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
}
