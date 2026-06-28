import { NextRequest, NextResponse } from "next/server";
import {
  deletePushSubscription,
  isPushConfigured,
  upsertPushSubscription,
} from "@/lib/push-server";

export const runtime = "nodejs";

function readClientId(request: NextRequest): string | null {
  const clientId = request.headers.get("x-client-id")?.trim();
  return clientId || null;
}

function parseSubscription(body: unknown): {
  endpoint: string;
  p256dh: string;
  auth: string;
} | null {
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  const endpoint = typeof row.endpoint === "string" ? row.endpoint.trim() : "";
  const keys =
    row.keys && typeof row.keys === "object"
      ? (row.keys as Record<string, unknown>)
      : null;
  const p256dh =
    keys && typeof keys.p256dh === "string" ? keys.p256dh.trim() : "";
  const authKey =
    keys && typeof keys.auth === "string" ? keys.auth.trim() : "";
  if (!endpoint || !p256dh || !authKey) return null;
  return { endpoint, p256dh, auth: authKey };
}

export async function POST(request: NextRequest) {
  const clientId = readClientId(request);
  if (!clientId) {
    return NextResponse.json({ error: "missing_client_id" }, { status: 400 });
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

  const subscription = parseSubscription(body);
  if (!subscription) {
    return NextResponse.json({ error: "invalid_subscription" }, { status: 400 });
  }

  await upsertPushSubscription({
    clientId,
    endpoint: subscription.endpoint,
    p256dh: subscription.p256dh,
    auth: subscription.auth,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const clientId = readClientId(request);
  if (!clientId) {
    return NextResponse.json({ error: "missing_client_id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const endpoint =
    body &&
    typeof body === "object" &&
    typeof (body as Record<string, unknown>).endpoint === "string"
      ? ((body as Record<string, unknown>).endpoint as string).trim()
      : "";

  if (!endpoint) {
    return NextResponse.json({ error: "missing_endpoint" }, { status: 400 });
  }

  await deletePushSubscription(clientId, endpoint);

  return NextResponse.json({ ok: true });
}
