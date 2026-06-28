import { NextRequest, NextResponse } from "next/server";
import { searchSessionsViaHermes } from "@/lib/hermes-search";

export const runtime = "nodejs";
export const maxDuration = 30;

const MIN_QUERY = 2;
const MAX_QUERY = 200;

export async function GET(request: NextRequest) {
  const requestId =
    request.headers.get("x-request-id")?.trim() || crypto.randomUUID();

  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (query.length < MIN_QUERY || query.length > MAX_QUERY) {
    return NextResponse.json(
      {
        error: "bad_request",
        detail: `query must be ${MIN_QUERY}-${MAX_QUERY} characters`,
        requestId,
      },
      { status: 400, headers: { "X-Request-Id": requestId } }
    );
  }

  const { data, status, upstreamStatus } = await searchSessionsViaHermes(
    query,
    requestId
  );

  if (!data) {
    return NextResponse.json(
      {
        error: "search_unavailable",
        requestId,
        results: [],
        meta: { query, count: 0, channel: "hermes-pwa" },
        upstreamStatus: upstreamStatus ?? status,
      },
      {
        status: status >= 400 ? status : 503,
        headers: {
          "X-Request-Id": requestId,
          "Cache-Control": "no-store",
        },
      }
    );
  }

  return NextResponse.json(data, {
    headers: {
      "X-Request-Id": requestId,
      "Cache-Control": "no-store",
    },
  });
}
