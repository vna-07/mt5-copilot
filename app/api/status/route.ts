import { NextResponse } from "next/server";
import { getStatus } from "@/lib/session";
import { getProvider } from "@/lib/data/provider";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: getStatus(),
    provider: getProvider().name,
    serverTime: new Date().toISOString(),
  });
}