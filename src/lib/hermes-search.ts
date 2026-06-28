import { resolveHermesConfig } from "@/lib/hermes-client";
import type {
  SessionSearchResponse,
  SessionSearchResult,
} from "@/lib/search-types";

const PWA_CHANNEL = "hermes-pwa";
const MAX_LIMIT = 20;

function coerceRole(value: unknown): "user" | "assistant" | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "user" || normalized === "assistant") return normalized;
  return null;
}

function coerceTimestamp(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1_000_000_000_000 ? value : value * 1000;
    return new Date(ms).toISOString();
  }
  return "";
}

function sessionIdFrom(row: Record<string, unknown>): string {
  for (const key of ["sessionId", "session_id", "sid", "id"]) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function pickSnippet(
  row: Record<string, unknown>,
  parent?: Record<string, unknown>
): string {
  for (const key of ["snippet", "preview", "content", "matched_text", "title"]) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim().replace(/\s+/g, " ").slice(0, 240);
    }
  }
  if (parent) {
    for (const key of ["snippet", "preview", "matched_text", "content", "title"]) {
      const value = parent[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim().replace(/\s+/g, " ").slice(0, 240);
      }
    }
  }
  return "";
}

function flattenSearchItems(rawResults: unknown[]): Array<{
  row: Record<string, unknown>;
  parent?: Record<string, unknown>;
}> {
  const flat: Array<{ row: Record<string, unknown>; parent?: Record<string, unknown> }> =
    [];

  for (const item of rawResults) {
    if (!item || typeof item !== "object") continue;
    const parent = item as Record<string, unknown>;
    const messages = parent.messages;
    if (Array.isArray(messages) && messages.length > 0) {
      for (const msg of messages) {
        if (msg && typeof msg === "object") {
          flat.push({ row: msg as Record<string, unknown>, parent });
        }
      }
      continue;
    }
    flat.push({ row: parent });
  }

  return flat;
}

function mapSearchHit(
  raw: unknown,
  {
    lenient = false,
    parent,
  }: { lenient?: boolean; parent?: Record<string, unknown> } = {}
): SessionSearchResult | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const parentRow =
    parent ??
    (row.__parent && typeof row.__parent === "object"
      ? (row.__parent as Record<string, unknown>)
      : undefined);

  const sessionId = sessionIdFrom(row) || (parentRow ? sessionIdFrom(parentRow) : "");
  const timestamp = coerceTimestamp(
    row.timestamp ??
      row.created_at ??
      row.started_at ??
      row.last_active ??
      (parentRow
        ? parentRow.timestamp ??
          parentRow.created_at ??
          parentRow.started_at ??
          parentRow.last_active
        : undefined)
  );
  const role =
    coerceRole(row.role ?? row.matched_role) ??
    (parentRow ? coerceRole(parentRow.role ?? parentRow.matched_role) : null);
  const resolvedSnippet = pickSnippet(row, parentRow);

  if (!sessionId || !resolvedSnippet) return null;
  if (!lenient && (!timestamp || !role)) return null;

  const result: SessionSearchResult = {
    sessionId,
    timestamp: timestamp || new Date().toISOString(),
    role: role ?? "assistant",
    snippet: resolvedSnippet,
  };

  if (typeof row.matchStart === "number" && row.matchStart >= 0) {
    result.matchStart = row.matchStart;
  }
  if (typeof row.matchEnd === "number" && row.matchEnd > (result.matchStart ?? 0)) {
    result.matchEnd = row.matchEnd;
  }

  return result;
}

export function parseSessionSearchResponse(
  content: string,
  fallbackQuery: string
): SessionSearchResponse | null {
  let trimmed = content.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)```\s*$/i.exec(trimmed);
  if (fenced) trimmed = fenced[1].trim();
  if (!trimmed.startsWith("{")) return null;

  try {
    const raw = JSON.parse(trimmed) as Record<string, unknown>;
    if (!Array.isArray(raw.results)) return null;

    const rawResults = raw.results as unknown[];
    const flattened = flattenSearchItems(rawResults);
    const results: SessionSearchResult[] = [];

    for (const { row, parent } of flattened) {
      const hit = mapSearchHit(row, { parent });
      if (hit) results.push(hit);
      if (results.length >= MAX_LIMIT) break;
    }

    if (results.length === 0 && rawResults.length > 0) {
      for (const item of rawResults) {
        const row = mapSearchHit(item, { lenient: true });
        if (row) results.push(row);
        if (results.length >= MAX_LIMIT) break;
      }
    }

    const metaRaw =
      raw.meta && typeof raw.meta === "object"
        ? (raw.meta as Record<string, unknown>)
        : null;
    const upstreamCount =
      typeof metaRaw?.count === "number" && metaRaw.count >= 0
        ? metaRaw.count
        : rawResults.length;
    const query =
      typeof metaRaw?.query === "string" && metaRaw.query.trim()
        ? metaRaw.query.trim()
        : fallbackQuery;
    const channel =
      typeof metaRaw?.channel === "string" ? metaRaw.channel.trim() : PWA_CHANNEL;

    const meta: SessionSearchResponse["meta"] = {
      query,
      count: results.length,
      channel,
    };

    if (upstreamCount > results.length) {
      meta.upstreamCount = upstreamCount;
    }

    return { results, meta };
  } catch {
    return null;
  }
}

export async function searchSessionsViaHermes(
  query: string,
  requestId: string
): Promise<{
  data: SessionSearchResponse | null;
  status: number;
  upstreamStatus?: number;
}> {
  const config = resolveHermesConfig();
  if (!config) {
    return { data: null, status: 503 };
  }

  const sessionId = `search-${crypto.randomUUID()}`;

  try {
    const res = await fetch(`${config.apiUrl}/sessions/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        "X-Hermes-Session-Id": sessionId,
        "X-Request-Id": requestId,
      },
      body: JSON.stringify({
        query,
        channel: PWA_CHANNEL,
        limit: MAX_LIMIT,
      }),
    });

    const upstreamStatus = res.status;
    const text = await res.text();

    if (!res.ok) {
      return { data: null, status: res.status, upstreamStatus };
    }

    let parsed: SessionSearchResponse | null = null;
    try {
      const json = JSON.parse(text) as Record<string, unknown>;
      if (Array.isArray(json.results)) {
        parsed = parseSessionSearchResponse(text, query);
      }
    } catch {
      parsed = parseSessionSearchResponse(text, query);
    }

    if (!parsed) {
      return { data: null, status: 502, upstreamStatus };
    }

    return { data: parsed, status: 200, upstreamStatus };
  } catch {
    return { data: null, status: 503 };
  }
}
