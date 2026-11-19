// lib/indicators.ts
// Pure indicator math. Matches pandas EWM / Wilder ATR conventions.

import type { Candle } from "./types";

/** Exponential moving average. Seeded with values[0], k = 2/(n+1). */
export function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0] ?? 0;
  for (let i = 0; i < values.length; i++) {
    prev = i === 0 ? values[i] : values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

/**
 * Wilder's Average True Range.
 * Seeds with SMA of the first `period` TRs, then applies Wilder smoothing.
 * Indices [0, period-2] are NaN (insufficient data).
 */
export function atrSeries(candles: Candle[], period = 14): number[] {
  const n = candles.length;
  const out: number[] = new Array(n).fill(NaN);
  if (n < period) return out;

  const tr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const c = candles[i];
    if (i === 0) {
      tr[i] = c.high - c.low;
    } else {
      const prevClose = candles[i - 1].close;
      tr[i] = Math.max(
        c.high - c.low,
        Math.abs(c.high - prevClose),
        Math.abs(c.low - prevClose)
      );
    }
  }

  let sum = 0;
  for (let i = 0; i < period; i++) sum += tr[i];
  let prev = sum / period;
  out[period - 1] = prev;

  for (let i = period; i < n; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}

/** Cumulative VWAP over the whole series. Missing/zero volume → weight 1. */
export function vwapSeries(candles: Candle[]): number[] {
  let pv = 0;
  let v = 0;
  return candles.map((c) => {
    const vol = c.volume && c.volume > 0 ? c.volume : 1;
    const typical = (c.high + c.low + c.close) / 3;
    pv += typical * vol;
    v += vol;
    return pv / v;
  });
}

/** Sample standard deviation (denominator n-1). */
export function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sq = values.reduce((a, b) => a + (b - mean) ** 2, 0);
  return Math.sqrt(sq / (values.length - 1));
}

/** Fraction of finite values in `values` that are <= v (0..1). */
export function percentileRank(values: number[], v: number): number {
  const finite = values.filter((x) => Number.isFinite(x));
  if (!finite.length) return 0.5;
  let n = 0;
  for (const x of finite) if (x <= v) n++;
  return n / finite.length;
}

/** Return last element (throws on empty — caller must guard length). */
export function last<T>(arr: T[]): T {
  return arr[arr.length - 1];
}

/** Round to `digits` decimal places, returns Number (not string). */
export function roundTo(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}