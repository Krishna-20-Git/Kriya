import { z } from 'zod';

/** Expo push tokens look like `ExponentPushToken[xxxxxxxx]` (or `ExpoPushToken[...]`). */
export const expoPushTokenSchema = z
  .string({ error: 'token is required' })
  .trim()
  .max(200, 'token is too long')
  .regex(/^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/, 'token must be an Expo push token');

const isTimeZone = (value: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

/** POST /api/notifications/devices — the phone's timezone decides when "this evening" is for its reminder. */
export const registerDeviceSchema = z.strictObject({
  token: expoPushTokenSchema,
  platform: z.enum(['android', 'ios'], { error: 'platform must be android or ios' }),
  timezone: z.string().trim().min(1).max(64).refine(isTimeZone, 'timezone must be an IANA time zone such as Asia/Kolkata'),
});
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;

/** DELETE /api/notifications/devices */
export const unregisterDeviceSchema = z.strictObject({ token: expoPushTokenSchema });
export type UnregisterDeviceInput = z.infer<typeof unregisterDeviceSchema>;
