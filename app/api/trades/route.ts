import { NextRequest, NextResponse } from "next/server";
import { accountKey, ensureSchema, getPool } from "@/lib/db";
import { randomUUID } from "crypto";

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
  const pool = getPool();
  if (pool) {
    await ensureSchema();
    const result = await pool.query(
      "select * from trade_state where account_key=$1 and closed=false order by updated_at desc",
      [accountKey(req)]
    );
    const trades = result.rows.map((row) => ({
      symbol: row.symbol,
      entry: Number(row.entry),
      sl: Number(row.sl),
      tp1: Number(row.tp1),
      tp2: Number(row.tp2),
      tp1Sent: row.tp1_sent,
      tp2Sent: row.tp2_sent,
      slSent: row.sl_sent,
      closed: row.closed,
      updatedAt: new Date(row.updated_at).getTime(),
    }));
    return NextResponse.json({ trades });
  }
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
    const pool = getPool();
    if (pool) {
      await ensureSchema();
      const key = accountKey(req);
      for (const trade of trades) {
        await pool.query(
          `insert into trade_state
            (id,account_key,symbol,direction,entry,sl,tp1,tp2,tp1_sent,tp2_sent,sl_sent,closed)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           on conflict(account_key,symbol) do update set
             direction=excluded.direction,
             entry=excluded.entry,
             sl=excluded.sl,
             tp1=excluded.tp1,
             tp2=excluded.tp2,
             closed=false,
             updated_at=now()`,
          [randomUUID(), key, trade.symbol, (body.directions?.[trade.symbol] ?? null),
            trade.entry, trade.sl, trade.tp1, trade.tp2,
            trade.tp1Sent, trade.tp2Sent, trade.slSent, trade.closed]
        );
      }
      return NextResponse.json({ ok: true, trades });
    }
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

export async function DELETE(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  const pool = getPool();
  if (!pool) return NextResponse.json({ ok: true });
  await ensureSchema();
  if (symbol) {
    await pool.query(
      "update trade_state set closed=true,updated_at=now() where account_key=$1 and symbol=$2",
      [accountKey(req), symbol]
    );
  }
  return NextResponse.json({ ok: true });
}
