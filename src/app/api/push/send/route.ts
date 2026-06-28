import { NextRequest, NextResponse } from "next/server";
import {
  isPushConfigured,
  sendPushToClient,
  verifyPushWebhookSecret,
  type PushPayload,
} from "@/lib/push-server";

export const runtime = "nodejs";

function parsePayload(body: unknown): (PushPayload & { clientId: string }) | null {
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  const clientId = typeof row.clientId === "string" ? row.clientId.trim() : "";
  const title = typeof row.title === "string" ? row.title.trim() : "";
  const bodyText = typeof row.body === "string" ? row.body.trim() : "";
  if (!clientId || !title || !bodyText) return null;

  const payload: PushPayload & { clientId: string } = {
    clientId,
    title,
    body: bodyText,
  };

  if (typeof row.url === "string" && row.url.trim()) payload.url = row.url.trim();
  if (typeof row.tag === "string" && row.tag.trim()) payload.tag = row.tag.trim();
  if (typeof row.sessionId === "string" && row.sessionId.trim()) {
    payload.sessionId = row.sessionId.trim();
  }

  return payload;
}

export async function POST(request: NextRequest) {
  if (!verifyPushWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPushConfigured()) {
    return NextResponse.json({ error: "push_not_configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const payload = parsePayload(body);
  if (!payload) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const { clientId, ...pushPayload } = payload;
  const result = await sendPushToClient(clientId, pushPayload);

  return NextResponse.json({ ok: true, ...result });
}
