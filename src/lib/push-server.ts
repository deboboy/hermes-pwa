import webpush, { type PushSubscription } from "web-push";
import {
  deletePushSubscriptionByEndpoint,
  listPushSubscriptionsForClient,
} from "@/lib/push-subscriptions-store";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  sessionId?: string;
};

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT
  );
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY?.trim() ?? null;
}

function ensureVapidConfigured(): void {
  const subject = process.env.VAPID_SUBJECT?.trim();
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!subject || !publicKey || !privateKey) {
    throw new Error("push_not_configured");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

function toWebPushSubscription(row: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): PushSubscription {
  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  };
}

export async function sendPushToClient(
  clientId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number; removed: number }> {
  ensureVapidConfigured();

  const rows = await listPushSubscriptionsForClient(clientId);

  let sent = 0;
  let failed = 0;
  let removed = 0;

  for (const row of rows) {
    try {
      await webpush.sendNotification(
        toWebPushSubscription(row),
        JSON.stringify(payload)
      );
      sent += 1;
    } catch (error) {
      failed += 1;
      const statusCode =
        error && typeof error === "object" && "statusCode" in error
          ? Number((error as { statusCode?: number }).statusCode)
          : undefined;
      if (statusCode === 404 || statusCode === 410) {
        await deletePushSubscriptionByEndpoint(row.endpoint);
        removed += 1;
      }
    }
  }

  return { sent, failed, removed };
}

export function verifyPushWebhookSecret(request: Request): boolean {
  const expected = process.env.PUSH_WEBHOOK_SECRET?.trim();
  if (!expected) return false;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${expected}`) return true;
  const header = request.headers.get("x-push-webhook-secret");
  return header === expected;
}

export {
  upsertPushSubscription,
  deletePushSubscription,
  countPushSubscriptionsForClient,
} from "@/lib/push-subscriptions-store";
