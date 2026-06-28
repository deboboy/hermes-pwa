import { NextResponse } from "next/server";
import { getVapidPublicKey, isPushConfigured } from "@/lib/push-server";

export async function GET() {
  if (!isPushConfigured()) {
    return NextResponse.json({ error: "push_not_configured" }, { status: 503 });
  }

  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return NextResponse.json({ error: "push_not_configured" }, { status: 503 });
  }

  return NextResponse.json(
    { publicKey },
    { headers: { "Cache-Control": "no-store" } }
  );
}
