"use client";

const STORAGE_KEY = "hermes-pwa-client-id";

export function getOrCreateClientId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const clientId = crypto.randomUUID();
  window.localStorage.setItem(STORAGE_KEY, clientId);
  return clientId;
}
