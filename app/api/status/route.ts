import { NextResponse } from "next/server";
import { getStatus } from "@/lib/session";
import { getProvider } from "@/lib/data/provider";
import { fetchEconomicEvents } from "@/lib/news";

export const dynamic = "force-dynamic";

export async function GET() {
  const news = await fetchEconomicEvents();
  return NextResponse.json({
    status: getStatus(),
    provider: getProvider().name,
    serverTime: new Date().toISOString(),
    news,
    newsFeedConfigured: Boolean(process.env.FINNHUB_API_KEY || process.env.ECONOMIC_NEWS_API_URL),
  });
}