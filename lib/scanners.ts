// lib/scanners.ts
import type { Candle, Direction, Instrument, Mode } from "./types";
import { atrSeries, ema, last, percentileRank, stdev, vwapSeries, roundTo } from "./indicators";

export type RawSignal = {
  direction: Direction;
  entryLow: number;
  entryHigh: number;
  atr: number;
  setup: string;
  reasons: string[];
  confidence: number;
};

const num = (v: number, d: number) => roundTo(v, d);

// 1. Trend Pullback (Intraday)
export function trendPullback(inst: Instrument, htf: Candle[], ltf: Candle[]): RawSignal | null {
  if (htf.length < 210 || ltf.length < 80) return null;
  const hCloses = htf.map((c) => c.close);
  const lCloses = ltf.map((c) => c.close);
  const h50 = ema(hCloses, 50), h200 = ema(hCloses, 200);
  const e20 = ema(lCloses, 20), e50 = ema(lCloses, 50), e200 = ema(lCloses, 200);
  const atrs = atrSeries(ltf, 14);
  const atr = last(atrs);
  if (!Number.isFinite(atr) || atr <= 0) return null;
  const atrRank = percentileRank(atrs.slice(-120), atr);
  if (atrRank < 0.20 || atrRank > 0.90) return null;

  const bull = last(e50) > last(e200) && last(h50) > last(h200);
  const bear = last(e50) < last(e200) && last(h50) < last(h200);
  if (!bull && !bear) return null;
  const direction: Direction = bull ? "BUY" : "SELL";

  const c = last(ltf);
  const ema20 = last(e20);
  const range = c.high - c.low;
  if (range < 0.25 * atr) return null;

  const pulledBack = direction === "BUY" ? c.low <= ema20 + 0.25 * atr : c.high >= ema20 - 0.25 * atr;
  if (!pulledBack) return null;

  const reject = direction === "BUY" ? c.close > c.low + 0.55 * range : c.close < c.high - 0.55 * range;
  if (!reject) return null;

  let confidence = 0.55;
  if (atrRank >= 0.35 && atrRank <= 0.7) confidence += 0.15;
  if (range > 0.6 * atr) confidence += 0.05;
  confidence = Math.min(0.95, confidence);

  const d = inst.digits;
  const entryHigh = direction === "BUY" ? Math.min(ema20 + 0.1 * atr, c.close) : Math.max(ema20 - 0.1 * atr, c.close);
  const entryLow = direction === "BUY" ? entryHigh - 0.4 * atr : entryHigh;
  const eHigh = direction === "BUY" ? entryHigh : entryLow + 0.4 * atr;
  const eLow = direction === "BUY" ? entryLow : entryHigh;

  return {
    direction, entryLow: num(Math.min(eLow, eHigh), d), entryHigh: num(Math.max(eLow, eHigh), d), atr,
    setup: "Trend Pullback",
    confidence: Number(confidence.toFixed(2)),
    reasons: [
      `H1 50 EMA is ${direction === "BUY" ? "above" : "below"} the 200 EMA → ${direction.toLowerCase()} bias.`,
      `Base-timeframe EMA 50 vs 200 agrees, so we trade with the trend.`,
      `Price pulled back into the 20 EMA (${num(ema20, d)}) and printed a rejection candle.`,
      `ATR is at the ${Math.round(atrRank * 100)}th percentile.`
    ],
  };
}

// 2. Opening Range Breakout (Scalp)
export function openingRangeBreakout(inst: Instrument, ltf: Candle[], ctx: { sessionOpenTs: number; nowTs: number }): RawSignal | null {
  if (!ctx.sessionOpenTs) return null;
  const after = ltf.filter((c) => c.time >= ctx.sessionOpenTs);
  if (after.length < 8) return null;
  const elapsed = ctx.nowTs - ctx.sessionOpenTs;
  if (elapsed > 90 * 60) return null;

  const rangeCandles = after.slice(0, 6);
  const rangeHigh = Math.max(...rangeCandles.map((c) => c.high));
  const rangeLow = Math.min(...rangeCandles.map((c) => c.low));
  const rangeSize = rangeHigh - rangeLow;
  if (rangeSize <= 0) return null;

  const atrs = atrSeries(ltf, 14);
  const atr = last(atrs);
  if (!Number.isFinite(atr) || atr <= 0) return null;
  if (rangeSize < 0.5 * atr) return null;

  const c = last(ltf);
  const p = ltf[ltf.length - 2];
  const d = inst.digits;

  const brokeUp = c.close > rangeHigh && p.close <= rangeHigh;
  const brokeDown = c.close < rangeLow && p.close >= rangeLow;
  if (!brokeUp && !brokeDown) return null;

  const direction: Direction = brokeUp ? "BUY" : "SELL";
  const buffer = 0.2 * atr;
  const entryLow = direction === "BUY" ? rangeHigh : rangeLow - buffer;
  const entryHigh = direction === "BUY" ? rangeHigh + buffer : rangeLow;

  return {
    direction, entryLow: num(entryLow, d), entryHigh: num(entryHigh, d), atr, setup: "Opening Range Breakout", confidence: 0.8,
    reasons: [
      `The first 30 mins built a range (${num(rangeLow, d)} – ${num(rangeHigh, d)}).`,
      `Price closed ${direction === "BUY" ? "above" : "below"} the range.`,
      `Entering on a retest keeps the stop tight.`
    ],
  };
}

// 3. VWAP Mean Reversion (Scalp fallback)
export function vwapMeanReversion(inst: Instrument, ltf: Candle[]): RawSignal | null {
  if (ltf.length < 80) return null;
  const vwaps = vwapSeries(ltf);
  const atrs = atrSeries(ltf, 14);
  const atr = last(atrs);
  if (!Number.isFinite(atr) || atr <= 0) return null;

  const atrRank = percentileRank(atrs.slice(-120), atr);
  if (atrRank > 0.65) return null;

  const N = 60;
  const devs = ltf.slice(-N).map((c, i) => c.close - vwaps[vwaps.length - N + i]);
  const sigma = stdev(devs);
  if (!(sigma > 0)) return null;

  const c = last(ltf);
  const vwap = last(vwaps);
  const z = (c.close - vwap) / sigma;
  if (Math.abs(z) < 2) return null;

  const direction: Direction = z <= -2 ? "BUY" : "SELL";
  const d = inst.digits;
  const entryLow = direction === "BUY" ? c.close - 0.15 * atr : c.close - 0.05 * atr;
  const entryHigh = direction === "BUY" ? c.close + 0.05 * atr : c.close + 0.15 * atr;

  return {
    direction, entryLow: num(entryLow, d), entryHigh: num(entryHigh, d), atr, setup: "VWAP Mean Reversion", confidence: 0.7,
    reasons: [
      `Price is ${Math.abs(z).toFixed(1)}σ ${z > 0 ? "above" : "below"} VWAP.`,
      `Volatility is calm, so stretched moves tend to snap back.`,
      `Target is VWAP (${num(vwap, d)}).`
    ],
  };
}

export function runScan(args: { mode: Mode; inst: Instrument; htf: Candle[]; ltf: Candle[]; sessionOpenTs: number; nowTs: number; }): RawSignal | null {
  const { mode, inst, htf, ltf, sessionOpenTs, nowTs } = args;
  if (mode === "intraday") return trendPullback(inst, htf, ltf);
  if (mode === "scalp") return openingRangeBreakout(inst, ltf, { sessionOpenTs, nowTs }) ?? vwapMeanReversion(inst, ltf);
  return trendPullback(inst, htf, ltf);
}