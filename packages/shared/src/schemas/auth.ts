import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const schemas = { login: loginSchema };
