import { NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const { message, history } = (await request.json()) as {
      message: string;
      history: Array<{ role: string; content: string }>;
    };

    // Replace with your actual Hermes backend URL
    // This can be set via NEXT_PUBLIC_HERMES_API_URL env var
    const backendUrl = process.env.HERMES_API_URL || "http://localhost:3001";

    const response = await fetch(`${backendUrl}/v1/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        history: history.map((h) => ({ role: h.role, content: h.content })),
        source: "pwa",
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
