import { NextResponse } from "next/server";
import { getStatus } from "@/lib/session";
import { getProvider } from "@/lib/data/provider";

export const dynamic = "force-dynamic";

export async function GET() {
  const newsUrl = process.env.ECONOMIC_NEWS_API_URL;
  const finnhubKey = process.env.FINNHUB_API_KEY;
  let news: unknown = null;
  const resolvedNewsUrl = newsUrl ||
    (finnhubKey
      ? `https://finnhub.io/api/v1/calendar/economic?from=${new Date().toISOString().slice(0, 10)}&to=${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}&token=${encodeURIComponent(finnhubKey)}`
      : "");
  if (resolvedNewsUrl) {
    try {
      const res = await fetch(resolvedNewsUrl, { cache: "no-store" });
      if (res.ok) news = await res.json();
    } catch {}
  }
  return NextResponse.json({
    status: getStatus(),
    provider: getProvider().name,
    serverTime: new Date().toISOString(),
    news,
    newsFeedConfigured: Boolean(resolvedNewsUrl),
  });
}