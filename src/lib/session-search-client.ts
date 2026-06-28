import type { SessionSearchResponse } from "@/lib/search-types";

export async function fetchSessionHistory(query: string): Promise<{
  data: SessionSearchResponse | null;
  error: boolean;
  status?: number;
  upstreamStatus?: number;
}> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { data: null, error: false };
  }

  const params = new URLSearchParams({ q: trimmed });
  const requestId = crypto.randomUUID();

  try {
    const res = await fetch(`/api/search?${params.toString()}`, {
      credentials: "same-origin",
      headers: { "X-Request-Id": requestId },
    });

    const body = (await res.json()) as SessionSearchResponse & {
      error?: string;
      upstreamStatus?: number;
    };

    if (!res.ok) {
      return {
        data: null,
        error: true,
        status: res.status,
        upstreamStatus:
          typeof body.upstreamStatus === "number" ? body.upstreamStatus : undefined,
      };
    }

    if (!Array.isArray(body.results) || !body.meta) {
      return { data: null, error: true, status: res.status };
    }

    return { data: body, error: false, status: res.status };
  } catch {
    return { data: null, error: true };
  }
}
