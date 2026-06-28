const DB_NAME = "hermes-pwa-transcript-v1";
const DB_VERSION = 1;
const STORE = "messages";

export interface TranscriptRecord {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  sessionId: string;
}

export interface LocalSearchHit {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  source: "memory" | "indexeddb";
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("indexedDB unavailable"));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("timestamp", "timestamp");
          store.createIndex("sessionId", "sessionId");
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("idb open failed"));
    });
  }
  return dbPromise;
}

export async function appendTranscript(record: TranscriptRecord): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("idb put failed"));
    });
  } catch {
    // Search resilience — chat still works if IDB fails.
  }
}

export async function loadTranscriptForSession(
  sessionId: string
): Promise<TranscriptRecord[]> {
  try {
    const db = await openDb();
    const records = await new Promise<TranscriptRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as TranscriptRecord[]) ?? []);
      req.onerror = () => reject(req.error ?? new Error("idb getAll failed"));
    });

    return records
      .filter((row) => row.sessionId === sessionId)
      .sort((a, b) => a.timestamp - b.timestamp);
  } catch {
    return [];
  }
}

function matchesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}

export async function searchLocalTranscript(
  query: string,
  limit = 20
): Promise<LocalSearchHit[]> {
  const trimmed = query.trim();
  if (trimmed.length < 1) return [];

  try {
    const db = await openDb();
    const records = await new Promise<TranscriptRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as TranscriptRecord[]) ?? []);
      req.onerror = () => reject(req.error ?? new Error("idb getAll failed"));
    });

    const hits: LocalSearchHit[] = [];
    const sorted = records.sort((a, b) => b.timestamp - a.timestamp);
    for (const row of sorted) {
      if (!matchesQuery(row.content, trimmed)) continue;
      hits.push({
        id: row.id,
        role: row.role,
        content: row.content,
        timestamp: row.timestamp,
        source: "indexeddb",
      });
      if (hits.length >= limit) break;
    }
    return hits;
  } catch {
    return [];
  }
}

export function searchMemoryTranscript(
  messages: {
    id: string;
    role: string;
    content: string;
    timestamp: string | number;
    isStreaming?: boolean;
  }[],
  query: string,
  limit = 20
): LocalSearchHit[] {
  const trimmed = query.trim();
  if (trimmed.length < 1) return [];

  const hits: LocalSearchHit[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "user" && msg.role !== "assistant") continue;
    if (msg.isStreaming) continue;
    if (!matchesQuery(msg.content, trimmed)) continue;
    hits.push({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp:
        typeof msg.timestamp === "number"
          ? msg.timestamp
          : new Date(msg.timestamp).getTime(),
      source: "memory",
    });
    if (hits.length >= limit) break;
  }
  return hits;
}

export function mergeLocalHits(
  memory: LocalSearchHit[],
  indexed: LocalSearchHit[],
  limit = 20
): LocalSearchHit[] {
  const seen = new Set<string>();
  const merged: LocalSearchHit[] = [];
  for (const hit of [...memory, ...indexed]) {
    if (seen.has(hit.id)) continue;
    seen.add(hit.id);
    merged.push(hit);
    if (merged.length >= limit) break;
  }
  return merged.sort((a, b) => b.timestamp - a.timestamp);
}

export function transcriptToChatMessages(
  records: TranscriptRecord[]
): Array<{
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}> {
  return records.map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    timestamp: new Date(row.timestamp).toISOString(),
  }));
}
