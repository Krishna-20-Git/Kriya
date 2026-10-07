import { env } from '../config/env.js';

/** https://docs.expo.dev/push-notifications/sending-notifications/ */
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100; // Expo accepts at most 100 messages per request.

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Must match the channel the Android app creates. */
  channelId?: string;
  sound?: 'default' | null;
}

/** Per-message outcome. `permanent` failures (e.g. the app was uninstalled) mean the token should be deleted. */
export type PushResult = { token: string; ok: true } | { token: string; ok: false; permanent: boolean; error: string };

export type PushSender = (messages: PushMessage[]) => Promise<PushResult[]>;

interface ExpoTicket {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

export const sendExpoPush: PushSender = async (messages) => {
  const results: PushResult[] = [];
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`Expo push service responded ${response.status}`);
      const { data } = (await response.json()) as { data: ExpoTicket[] };
      batch.forEach((message, index) => {
        const ticket = data[index];
        if (ticket?.status === 'ok') results.push({ token: message.to, ok: true });
        else
          results.push({
            token: message.to,
            ok: false,
            permanent: ticket?.details?.error === 'DeviceNotRegistered',
            error: ticket?.details?.error ?? ticket?.message ?? 'Unknown error',
          });
      });
    } catch (error) {
      // Network or service failure: transient, so the job releases its claim and retries next run.
      for (const message of batch) results.push({ token: message.to, ok: false, permanent: false, error: String(error) });
    }
  }
  return results;
};
