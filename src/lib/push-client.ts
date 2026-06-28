"use client";

import { getOrCreateClientId } from "@/lib/client-id";

export type PushSupportState =
  | "unsupported"
  | "needs-home-screen"
  | "ready"
  | "denied"
  | "subscribed";

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isStandalonePwa(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator &&
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true)
  );
}

export function getPushSupportState(
  permission: NotificationPermission | null
): PushSupportState {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return "unsupported";
  }
  if (!isStandalonePwa()) {
    return "needs-home-screen";
  }
  if (permission === "denied") {
    return "denied";
  }
  return "ready";
}

export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.ready;
}

function pushHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-Client-Id": getOrCreateClientId(),
  };
}

export async function fetchVapidPublicKey(): Promise<string> {
  const res = await fetch("/api/push/vapid-public-key", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`vapid_unavailable HTTP ${res.status}`);
  }
  const data = (await res.json()) as { publicKey?: string };
  if (!data.publicKey) {
    throw new Error("vapid_missing");
  }
  return data.publicKey;
}

export async function subscribeToPushNotifications(): Promise<PushSubscription> {
  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    throw new Error("service_worker_unavailable");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("notification_permission_denied");
  }

  const publicKey = await fetchVapidPublicKey();
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    }));

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    credentials: "same-origin",
    headers: pushHeaders(),
    body: JSON.stringify(subscription.toJSON()),
  });

  if (!res.ok) {
    throw new Error(`subscribe_failed HTTP ${res.status}`);
  }

  return subscription;
}

export async function unsubscribeFromPushNotifications(): Promise<void> {
  const registration = await getServiceWorkerRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  await fetch("/api/push/subscribe", {
    method: "DELETE",
    credentials: "same-origin",
    headers: pushHeaders(),
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });

  await subscription.unsubscribe();
}

export async function sendTestPushNotification(): Promise<void> {
  const res = await fetch("/api/push/test", {
    method: "POST",
    credentials: "same-origin",
    headers: pushHeaders(),
  });
  if (!res.ok) {
    throw new Error(`test_push_failed HTTP ${res.status}`);
  }
}
