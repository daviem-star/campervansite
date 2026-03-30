import { NextRequest, NextResponse } from "next/server";

type AnalyticsBody = {
  event?: string;
  payload?: Record<string, unknown>;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as AnalyticsBody | null;

  if (!body?.event || typeof body.event !== "string") {
    return NextResponse.json({ error: "Event name is required." }, { status: 400 });
  }

  console.info("[analytics]", {
    event: body.event,
    payload: body.payload ?? {},
    at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
