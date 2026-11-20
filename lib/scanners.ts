import type { Candle, Direction, Instrument, Mode } from "./types";
import { atrSeries, ema, last, percentileRank, adxSeries, rsiSeries, stdev, vwapSeries } from "./indicators";

export type RawSignal = {
  direction: Direction;
  entryLow: number;
  entryHigh: number;
  atr: number;
  setup: string;
  reasons: string[];
  confidence: number; // 0-100
  orderType: "MARKET" | "LIMIT";
};

export function runScan(args: {
  mode: Mode; inst: Instrument; htf: Candle[]; ltf: Candle[]; 
  sessionOpenTs: number; nowTs: number; activeTrades: string[]; currentSpread: number; maxOpenTrades?: number;
}): RawSignal | null {
  const { mode, inst, htf, ltf, activeTrades, currentSpread } = args;
  if (htf.length < 210 || ltf.length < 80) return null;

  // --- STAGE 2: CALCULATE FEATURES ---
  const closes = ltf.map(c => c.close);
  const e20 = ema(closes, 20), e50 = ema(closes, 50), e200 = ema(closes, 200);
  const atrs = atrSeries(ltf, 14);
  const adxs = adxSeries(ltf, 14);
  const rsis = rsiSeries(ltf, 14);
  const vwaps = vwapSeries(ltf);
  const e20Series = ema(closes, 20);
  const e50Series = ema(closes, 50);
  const e200Series = ema(closes, 200);
  
  const c = last(ltf);
  const p = ltf[ltf.length - 2];
  const atr = last(atrs);
  const adx = last(adxs);
  const rsi = last(rsis);
  const vwap = last(vwaps);

  if (!Number.isFinite(atr) || atr <= 0) return null;

  // Stage 1: Spread & ATR Filter (Max 15% of ATR)
  if (currentSpread > 0.15 * atr) return null;

  // Stage 1: Portfolio Heat Guard
  const maxOpenTrades = args.maxOpenTrades ?? 3;
  if (activeTrades.length >= maxOpenTrades || activeTrades.includes(inst.symbol)) return null;

  // Stage 1: ATR Percentile Filter
  const atrRank = percentileRank(atrs.slice(-100), atr);
  if (atrRank < 0.20 || atrRank > 0.85) return null;

  // Stage 2: Regime and unstable-volatility guard.
  const e20Slope = (last(e20Series) - e20Series[Math.max(0, e20Series.length - 6)]) / atr;
  const e50Slope = (last(e50Series) - e50Series[Math.max(0, e50Series.length - 6)]) / atr;
  const unstableAtrRank = atrRank > 0.90;
  if (unstableAtrRank) return null;

  // VWAP SD Bands
  const vwapDevs = ltf.slice(-48).map((x, i) => x.close - vwaps[vwaps.length - 48 + i]);
  const sd = stdev(vwapDevs) || atr;
  const upperBand = vwap + 2 * sd;
  const lowerBand = vwap - 2 * sd;

  // HTF Bias
  const htfE50 = last(ema(htf.map(x => x.close), 50));
  const htfE200 = last(ema(htf.map(x => x.close), 200));
  const isBull = last(e50) > last(e200) && htfE50 > htfE200;
  const isBear = last(e50) < last(e200) && htfE50 < htfE200;

  let direction: Direction | null = null;
  let setup = "";
  let score = 0;
  let reasons: string[] = [];
  let orderType: "MARKET" | "LIMIT" = "MARKET";
  const isTrending = adx >= 23;
  const isRanging = adx < 20;
  const bearishEmaSlope = e20Slope < -0.05 && e50Slope < -0.05;
  const bullishEmaSlope = e20Slope > 0.05 && e50Slope > 0.05;

  const bullishFvg = ltf.length >= 3 && ltf[ltf.length - 3].high < ltf[ltf.length - 1].low;
  const bearishFvg = ltf.length >= 3 && ltf[ltf.length - 3].low > ltf[ltf.length - 1].high;
  const candleRange = c.high - c.low;
  const displacement = candleRange >= 1.5 * atr;

  // --- STAGE 3: STRATEGY MATCHING ---
  // Engine A: Trend Pullback
  if (isTrending && bullishEmaSlope && isBull && c.close > last(e50)) {
    if (p.low <= Math.max(last(e20), vwap) && c.close > last(e20) && c.close > vwap && c.close > c.open) {
      direction = "BUY"; setup = "Trend Value Pullback";
      score += 55;
      reasons.push(`Strong bullish trend (ADX ${adx.toFixed(1)}) with price reclaiming the 20 EMA & VWAP.`);
      if (bullishFvg) { score += 5; reasons.push("A recent bullish fair-value gap reinforces the reclaim."); }
      if (displacement) { score += 5; reasons.push("The trigger candle shows directional displacement."); }
    }
  } else if (isTrending && bearishEmaSlope && isBear && c.close < last(e50)) {
    if (p.high >= Math.min(last(e20), vwap) && c.close < last(e20) && c.close < vwap && c.close < c.open) {
      direction = "SELL"; setup = "Trend Value Pullback";
      score += 55;
      reasons.push(`Strong bearish trend (ADX ${adx.toFixed(1)}) with price rejecting the 20 EMA & VWAP.`);
      if (bearishFvg) { score += 5; reasons.push("A recent bearish fair-value gap reinforces the rejection."); }
      if (displacement) { score += 5; reasons.push("The trigger candle shows directional displacement."); }
    }
  }

  // Engine B: Liquidity Sweep (Simplified for TypeScript)
  if (!direction && adx >= 20) {
    const recentHigh = Math.max(...ltf.slice(-16, -1).map(x => x.high));
    const recentLow = Math.min(...ltf.slice(-16, -1).map(x => x.low));
    if (p.low < recentLow && c.close > recentLow && c.close > vwap) {
      direction = "BUY"; setup = "Session Liquidity Sweep";
      score += 50;
      reasons.push("Swept the 15-bar low, trapping sellers, and reclaimed VWAP.");
      if (bullishFvg) score += 5;
    } else if (p.high > recentHigh && c.close < recentHigh && c.close < vwap) {
      direction = "SELL"; setup = "Session Liquidity Sweep";
      score += 50;
      reasons.push("Swept the 15-bar high, trapping buyers, and rejected below VWAP.");
      if (bearishFvg) score += 5;
    }
  }

  // Engine C: Opening Range Breakout
  if (!direction && args.sessionOpenTs > 0) {
    const sessionCandles = ltf.filter((x) => x.time >= args.sessionOpenTs).slice(0, 16);
    if (sessionCandles.length >= 8) {
      const openingHigh = Math.max(...sessionCandles.map((x) => x.high));
      const openingLow = Math.min(...sessionCandles.map((x) => x.low));
      if (c.close > openingHigh && c.close > last(e50)) {
        direction = "BUY";
        setup = "Opening Range Breakout";
        score += 50;
        reasons.push("Price broke above the session opening range and remains aligned with the 50 EMA.");
      } else if (c.close < openingLow && c.close < last(e50)) {
        direction = "SELL";
        setup = "Opening Range Breakout";
        score += 50;
        reasons.push("Price broke below the session opening range and remains aligned with the 50 EMA.");
      }
    }
  }

  // Engine D: VWAP Mean Reversion
  if (!direction && adx < 20 && mode === "intraday") {
    if (isRanging && p.low <= lowerBand && c.close > lowerBand && rsi < 32) {
      direction = "BUY"; setup = "VWAP Mean Reversion";
      score += 45;
      reasons.push(`Ranging market (ADX < 20): Price swept -2SD VWAP with RSI ${rsi.toFixed(0)} oversold.`);
    } else if (isRanging && p.high >= upperBand && c.close < upperBand && rsi > 68) {
      direction = "SELL"; setup = "VWAP Mean Reversion";
      score += 45;
      reasons.push(`Ranging market (ADX < 20): Price swept +2SD VWAP with RSI ${rsi.toFixed(0)} overbought.`);
    }
  }

  if (!direction) return null;

  // --- STAGE 4: CONFLUENCE SCORING ---
  const bodyRatio = Math.abs(c.close - c.open) / (c.high - c.low || 1);
  if (bodyRatio >= 0.55) { score += 15; reasons.push(`Strong trigger candle (${Math.round(bodyRatio * 100)}% body conviction).`); }
  if (currentSpread <= 0.08 * atr) score += 10;
  
  if (score < 75) return null;

  const riskDist = atr * 1.5;
  const entryMid = c.close;
  const entryLow = direction === "BUY" ? entryMid - 0.1 * atr : entryMid - 0.4 * atr;
  const entryHigh = direction === "BUY" ? entryMid + 0.4 * atr : entryMid + 0.1 * atr;

  return {
    direction, entryLow, entryHigh, atr, setup, confidence: Math.min(score, 100),
    orderType: "MARKET",
    reasons: [
      ...reasons,
      `Confluence Score: ${Math.min(score, 100)}/100 (HTF Alignment + Session + Trigger).`,
    ]
  };
}