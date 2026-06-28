import { NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const { message, history, sessionId: clientSessionId } = (await request.json()) as {
      message: string;
      history: Array<{ role: string; content: string }>;
      sessionId?: string;
    };

    const headerSessionId = request.headers.get("x-hermes-session-id")?.trim();
    const sessionId = headerSessionId || clientSessionId || crypto.randomUUID();

    const rawUrl =
      process.env.HERMES_API_URL?.trim() ||
      process.env.NEXT_PUBLIC_HERMES_API_URL?.trim() ||
      "http://localhost:3001";
    const backendUrl = rawUrl.replace(/\/$/, "").replace(/\/v1$/, "");
    const apiKey = process.env.HERMES_API_KEY?.trim();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Hermes-Session-Id": sessionId,
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${backendUrl}/v1/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message,
        history: history.map((h) => ({ role: h.role, content: h.content })),
        source: "pwa",
        sessionId,
      }),
      // @ts-ignore fetch edge runtime
      duplex: "half",
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: text || "Backend error" },
        { status: response.status }
      );
    }

    // Stream the response back to the client
    if (response.body) {
      return new Response(response.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    return NextResponse.json({ error: "Empty response" }, { status: 500 });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    );
  }
}
