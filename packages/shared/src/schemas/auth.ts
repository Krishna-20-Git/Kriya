import { z } from 'zod';
import { LIMITS, email, requiredText } from '../primitives.js';

export const passwordSchema = z
  .string({ error: 'Password is required' })
  .min(LIMITS.password.min, `Password must be at least ${LIMITS.password.min} characters`)
  .max(LIMITS.password.max, `Password must be at most ${LIMITS.password.max} characters`)
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const registerSchema = z.strictObject({
  fullName: requiredText('Full name', LIMITS.fullName.max).min(
    LIMITS.fullName.min,
    `Full name must be at least ${LIMITS.fullName.min} characters`,
  ),
  email,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

/** Login deliberately does not re-check password strength: that would leak the password policy on every attempt. */
export const loginSchema = z.strictObject({
  email,
  password: z
    .string({ error: 'Password is required' })
    .min(1, 'Password is required')
    .max(LIMITS.password.max, 'Password is too long'),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Mobile sends its refresh token in the body; the web app sends it as an HttpOnly cookie instead. */
export const refreshSchema = z.strictObject({
  refreshToken: z.string().min(1).max(512).optional(),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

/** Client-side only: adds the confirm-password check to the register form. */
export const registerFormSchema = registerSchema
  .extend({
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
export type RegisterFormValues = z.input<typeof registerFormSchema>;
