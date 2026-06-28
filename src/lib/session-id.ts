const SESSION_STORAGE_KEY = "hermes-session-id";

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const id = crypto.randomUUID?.() ?? `session-${Date.now()}`;
  window.localStorage.setItem(SESSION_STORAGE_KEY, id);
  return id;
}

export function persistSessionId(sessionId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
}
