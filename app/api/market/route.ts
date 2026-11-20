import { NextRequest, NextResponse } from "next/server";
import { bySymbol, WATCHLIST } from "@/lib/watchlist";
import { getProvider, type Timeframe } from "@/lib/data/provider";
import { adxSeries, atrSeries, ema, rsiSeries, stdev, vwapSeries, last } from "@/lib/indicators";
import { readSettings } from "@/lib/settings";
import type { Instrument } from "@/lib/types";

const TF: Record<string, Timeframe> = {
  M1: "1min",
  M5: "5min",
  M15: "15min",
  H1: "1h",
  H4: "4h",
};

function contractDefaults(inst: Instrument) {
  if (inst.category === "forex") return { contractSize: 100000, pointValuePerLot: inst.pipValuePerLot, stopsLevel: 50 };
  if (inst.category === "commodity") return { contractSize: 100, pointValuePerLot: inst.pipValuePerLot, stopsLevel: 50 };
  if (inst.category === "index") return { contractSize: 1, pointValuePerLot: inst.pipValuePerLot, stopsLevel: 50 };
  if (inst.category === "crypto") return { contractSize: 1, pointValuePerLot: inst.pipValuePerLot, stopsLevel: 100 };
  return { contractSize: 1, pointValuePerLot: inst.pipValuePerLot, stopsLevel: 50 };
}

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get("symbol") || "XAUUSD").toUpperCase();
  const timeframe = (req.nextUrl.searchParams.get("tf") || "M15").toUpperCase();
  const inst = bySymbol(symbol) || bySymbol("XAUUSD")!;
  const settings = readSettings(req);
  const provider = getProvider();
  const tf = TF[timeframe] || "15min";
  const count = timeframe === "M1" || timeframe === "M5" ? 320 : timeframe === "H4" ? 220 : 260;

  try {
    const candles = await provider.fetchCandles(inst, tf, count);
    const quote = provider.fetchQuote ? await provider.fetchQuote(inst).catch(() => null) : null;
    const atrs = atrSeries(candles, 14);
    const adxs = adxSeries(candles, 14);
    const rsis = rsiSeries(candles, 14);
    const closes = candles.map((c) => c.close);
    const atr = last(atrs) || 0;
    const adx = last(adxs) || 0;
    const rsi = last(rsis) || 50;
    const vwaps = vwapSeries(candles);
    const vwap = last(vwaps) || closes[closes.length - 1];
    const spread = quote ? Math.abs(quote.ask - quote.bid) : inst.maxSpread * 0.2;
    const spreadSource = quote ? "LIVE" : "ESTIMATED";
    const spreadToAtrPct = atr > 0 ? (spread / atr) * 100 : 100;

    const e20 = ema(closes, 20);
    const e50 = ema(closes, 50);
    const e200 = ema(closes, 200);
    const latest = candles[candles.length - 1];
    const previous = candles[candles.length - 2];
    const displacement = previous ? Math.abs(latest.close - previous.close) >= atr * 1.1 : false;
    const bullishFvg = candles.length >= 3 && candles[candles.length - 3].high < latest.low;
    const bearishFvg = candles.length >= 3 && candles[candles.length - 3].low > latest.high;

    const recentBodies = candles.slice(-20).map((c) => Math.abs(c.close - c.open));
    const recentRanges = candles.slice(-20).map((c) => c.high - c.low || 1);
    const tickPressure = Math.round(
      50 + (recentBodies.reduce((sum, body, i) => sum + (candles[candles.length - 20 + i].close >= candles[candles.length - 20 + i].open ? body : -body), 0) /
        recentRanges.reduce((sum, range) => sum + range, 0) * 18)
    );
    const buyPressure = Math.max(0, Math.min(100, tickPressure));
    const avgVolume = candles.slice(-21, -1).reduce((sum, c) => sum + (c.volume || 1), 0) / 20;
    const rvol = avgVolume > 0 ? (latest.volume || 1) / avgVolume : 1;

    const equityUsd = settings.currency === "ZAR"
      ? settings.balance / settings.exchangeRateZarPerUsd
      : settings.balance;
    const stopRisk = Math.max(atr * 1.5, inst.pipSize * 3);
    const riskUsd = equityUsd * (settings.riskPercent / 100);
    const lotSizeRaw = riskUsd / ((stopRisk / inst.pipSize) * inst.pipValuePerLot);
    const lotSize = Math.max(inst.minLot, Math.floor(lotSizeRaw / inst.lotStep) * inst.lotStep);
    const contracts = contractDefaults(inst);
    const entry = latest.close;
    const requiredMargin = (lotSize * contracts.contractSize * entry) / 500;
    const freeMargin = equityUsd - requiredMargin;
    const marginSafe = requiredMargin <= equityUsd * 0.15 && freeMargin >= equityUsd * 0.2;

    const regime = adx >= 23 ? "TRENDING" : adx < 20 ? "RANGING" : "CHAOTIC";
    const sd = stdev(candles.slice(-48).map((c) => c.close - vwap)) || atr;

    return NextResponse.json({
      symbol: inst.symbol,
      mt5Symbol: inst.mt5Symbol,
      name: inst.name,
      timeframe,
      provider: provider.name,
      spreadSource,
      bid: quote?.bid ?? null,
      ask: quote?.ask ?? null,
      spread,
      spreadToAtrPct: Number(spreadToAtrPct.toFixed(1)),
      candles,
      overlays: {
        e20: e20.slice(-candles.length),
        e50: e50.slice(-candles.length),
        e200: e200.slice(-candles.length),
        vwap: vwaps,
        lowerVwapBand: vwaps.map((v) => v - 2 * sd),
        upperVwapBand: vwaps.map((v) => v + 2 * sd),
      },
      telemetry: {
        buyPressure,
        sellPressure: 100 - buyPressure,
        rvol: Number(rvol.toFixed(2)),
        displacement,
        bullishFvg,
        bearishFvg,
        adx: Number(adx.toFixed(1)),
        atr: Number(atr),
        rsi: Number(rsi.toFixed(1)),
        regime,
        latestOhlc: latest,
      },
      margin: {
        leverage: 500,
        accountCurrency: settings.currency,
        balance: settings.balance,
        lotSize: Number(lotSize.toFixed(2)),
        contractSize: contracts.contractSize,
        pointValuePerLot: contracts.pointValuePerLot,
        stopsLevel: contracts.stopsLevel,
        requiredMarginUsd: Number(requiredMargin.toFixed(2)),
        requiredMarginZar: settings.currency === "ZAR"
          ? Number((requiredMargin * settings.exchangeRateZarPerUsd).toFixed(2))
          : Number((requiredMargin * settings.exchangeRateZarPerUsd).toFixed(2)),
        freeMarginUsd: Number(freeMargin.toFixed(2)),
        marginSafe,
        verified: Boolean(inst.contractVerified),
      },
      symbols: WATCHLIST.map((item) => ({ symbol: item.symbol, name: item.name })),
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Market data unavailable.",
    }, { status: 502 });
  }
}
