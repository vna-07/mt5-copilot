export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import webPush from "web-push";
import { ensureSchema, getPool } from "@/lib/db";
import { getProvider } from "@/lib/data/provider";
import { bySymbol } from "@/lib/watchlist";

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    publicKey,
    privateKey
  );
  return true;
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not configured." },
      { status: 503 }
    );
  }
  if (req.headers.get("x-cron-secret") !== cronSecret && bearer !== cronSecret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const pool = getPool();
  if (!pool) return NextResponse.json({ ok: true, configured: false, checked: 0 });
  await ensureSchema();

  const pushReady = configureWebPush();
  const provider = getProvider();
  const trades = await pool.query(
    "select * from trade_state where closed=false"
  );
  let checked = 0;
  let notified = 0;

  for (const trade of trades.rows) {
    const inst = bySymbol(trade.symbol);
    if (!inst) continue;
    checked++;

    let price: number | null = null;
    const quote = provider.fetchQuote ? await provider.fetchQuote(inst).catch(() => null) : null;
    if (quote) {
      price = (quote.bid + quote.ask) / 2;
    } else {
      const candles = await provider.fetchCandles(inst, "5min", 2).catch(() => []);
      if (candles.length) price = candles[candles.length - 1].close;
    }
    if (price === null || !Number.isFinite(price)) continue;

    const isBuy = trade.direction !== "SELL";
    const tp1Hit = isBuy ? price >= Number(trade.tp1) : price <= Number(trade.tp1);
    const tp2Hit = isBuy ? price >= Number(trade.tp2) : price <= Number(trade.tp2);
    const slHit = isBuy ? price <= Number(trade.sl) : price >= Number(trade.sl);

    const updates: string[] = [];
    const notifications: Array<{ title: string; body: string }> = [];

    if (tp1Hit && !trade.tp1_sent) {
      updates.push("tp1_sent=true");
      notifications.push({
        title: `${trade.symbol} reached TP1`,
        body: "Move the stop to breakeven and let the runner continue.",
      });
    }
    if (tp2Hit && !trade.tp2_sent) {
      updates.push("tp2_sent=true");
      notifications.push({
        title: `${trade.symbol} reached TP2`,
        body: "TP2 has been reached. Review and close the remaining position.",
      });
    }
    if (slHit && !trade.sl_sent) {
      updates.push("sl_sent=true");
      notifications.push({
        title: `${trade.symbol} stop-loss reached`,
        body: "The recorded stop level was reached. Close or verify the position in MT5.",
      });
    }
    if (updates.length) {
      await pool.query(
        `update trade_state set ${updates.join(",")},closed=closed or $2,updated_at=now() where id=$1`,
        [trade.id, slHit]
      );
    }

    if (pushReady && notifications.length) {
      const subscriptionRow = await pool.query(
        "select subscription from push_subscriptions where account_key=$1",
        [trade.account_key]
      );
      if (subscriptionRow.rows[0]) {
        for (const notification of notifications) {
          await webPush.sendNotification(
            subscriptionRow.rows[0].subscription,
            JSON.stringify({ ...notification, url: "/" })
          ).catch(() => {});
          notified++;
        }
      }
    }
  }

  return NextResponse.json({ ok: true, configured: pushReady, checked, notified });
}
