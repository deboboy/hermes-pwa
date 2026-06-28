import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type PushSubscriptionRecord = {
  id: string;
  clientId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
};

type StoreShape = {
  subscriptions: PushSubscriptionRecord[];
};

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "push-subscriptions.json");

async function readStore(): Promise<StoreShape> {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as StoreShape;
    if (!Array.isArray(parsed.subscriptions)) {
      return { subscriptions: [] };
    }
    return parsed;
  } catch {
    return { subscriptions: [] };
  }
}

async function writeStore(store: StoreShape): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export async function upsertPushSubscription(input: {
  clientId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}): Promise<void> {
  const store = await readStore();
  const now = new Date().toISOString();
  const existingIndex = store.subscriptions.findIndex(
    (row) => row.endpoint === input.endpoint
  );

  if (existingIndex >= 0) {
    store.subscriptions[existingIndex] = {
      ...store.subscriptions[existingIndex],
      clientId: input.clientId,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
      updatedAt: now,
    };
  } else {
    store.subscriptions.push({
      id: crypto.randomUUID(),
      clientId: input.clientId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  await writeStore(store);
}

export async function deletePushSubscription(
  clientId: string,
  endpoint: string
): Promise<boolean> {
  const store = await readStore();
  const next = store.subscriptions.filter(
    (row) => !(row.clientId === clientId && row.endpoint === endpoint)
  );
  const removed = next.length !== store.subscriptions.length;
  if (removed) {
    await writeStore({ subscriptions: next });
  }
  return removed;
}

export async function deletePushSubscriptionByEndpoint(
  endpoint: string
): Promise<void> {
  const store = await readStore();
  const next = store.subscriptions.filter((row) => row.endpoint !== endpoint);
  if (next.length !== store.subscriptions.length) {
    await writeStore({ subscriptions: next });
  }
}

export async function listPushSubscriptionsForClient(
  clientId: string
): Promise<PushSubscriptionRecord[]> {
  const store = await readStore();
  return store.subscriptions.filter((row) => row.clientId === clientId);
}

export async function countPushSubscriptionsForClient(
  clientId: string
): Promise<number> {
  const rows = await listPushSubscriptionsForClient(clientId);
  return rows.length;
}
