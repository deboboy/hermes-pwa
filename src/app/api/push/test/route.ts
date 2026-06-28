import { NextRequest, NextResponse } from "next/server";
import { isPushConfigured, sendPushToClient } from "@/lib/push-server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const clientId = request.headers.get("x-client-id")?.trim();
  if (!clientId) {
    return NextResponse.json({ error: "missing_client_id" }, { status: 400 });
  }

  if (!isPushConfigured()) {
    return NextResponse.json({ error: "push_not_configured" }, { status: 503 });
  }

  const result = await sendPushToClient(clientId, {
    title: "Hermes",
    body: "Push notifications are working.",
    url: "/",
    tag: "hermes-test",
  });

  if (result.sent === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "no_active_subscriptions",
        ...result,
      },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, ...result });
}
