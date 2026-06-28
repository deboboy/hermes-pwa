export interface SessionSearchResult {
  sessionId: string;
  timestamp: string;
  role: "user" | "assistant";
  snippet: string;
  matchStart?: number;
  matchEnd?: number;
}

export interface SessionSearchMeta {
  query: string;
  count: number;
  channel: string;
  upstreamCount?: number;
}

export interface SessionSearchResponse {
  results: SessionSearchResult[];
  meta: SessionSearchMeta;
}
