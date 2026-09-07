import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(200)
  .refine((v) => /[A-Za-z]/.test(v) && /[0-9]/.test(v), 'Password must contain letters and numbers');

export const registerSchema = z.object({
  email: z.string().email().max(254).toLowerCase(),
  password: passwordSchema,
  fullName: z.string().min(2).max(120).trim(),
});

export const loginSchema = z.object({
  email: z.string().email().max(254).toLowerCase(),
  password: z.string().min(1).max(200),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
