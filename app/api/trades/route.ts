import { NextRequest, NextResponse } from "next/server";

export type TradeState = {
  symbol: string;
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp1Sent: boolean;
  tp2Sent: boolean;
  slSent: boolean;
  closed: boolean;
  updatedAt: number;
};

const COOKIE = "copilot_trades";

export async function GET(req: NextRequest) {
  const raw = req.cookies.get(COOKIE)?.value;
  let trades: TradeState[] = [];
  try {
    trades = raw ? JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) : [];
  } catch {}
  return NextResponse.json({ trades });
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.trades || !Array.isArray(body.trades)) {
      return NextResponse.json({ ok: false, error: "Invalid trade state." }, { status: 400 });
    }
    const trades: TradeState[] = body.trades.slice(0, 3).map((trade: TradeState) => ({
      ...trade,
      tp1Sent: Boolean(trade.tp1Sent),
      tp2Sent: Boolean(trade.tp2Sent),
      slSent: Boolean(trade.slSent),
      closed: Boolean(trade.closed),
      updatedAt: Date.now(),
    }));
    const res = NextResponse.json({ ok: true, trades });
    res.cookies.set(COOKIE, Buffer.from(JSON.stringify(trades)).toString("base64url"), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid trade payload." }, { status: 400 });
  }
}
