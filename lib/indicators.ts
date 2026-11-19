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

/**
 * Wilder's Average Directional Index (ADX).
 * Seeds with the first DX value at index `period*2`, then Wilder-smooths.
 * Indices [0, period*2-1] are NaN (insufficient data).
 */
export function adxSeries(candles: Candle[], period = 14): number[] {
  const n = candles.length;
  const out = new Array(n).fill(NaN);
  if (n < period * 2) return out;

  const tr = new Array(n).fill(0), plusDM = new Array(n).fill(0), minusDM = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    tr[i] = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    const up = candles[i].high - candles[i - 1].high;
    const dn = candles[i - 1].low - candles[i].low;
    plusDM[i] = up > dn && up > 0 ? up : 0;
    minusDM[i] = dn > up && dn > 0 ? dn : 0;
  }

  let smoothTR = tr.slice(1, period + 1).reduce((a, b) => a + b, 0);
  let smoothPlus = plusDM.slice(1, period + 1).reduce((a, b) => a + b, 0);
  let smoothMinus = minusDM.slice(1, period + 1).reduce((a, b) => a + b, 0);

  for (let i = period + 1; i < n; i++) {
    smoothTR = smoothTR - (smoothTR / period) + tr[i];
    smoothPlus = smoothPlus - (smoothPlus / period) + plusDM[i];
    smoothMinus = smoothMinus - (smoothMinus / period) + minusDM[i];

    const pDI = 100 * (smoothPlus / smoothTR);
    const mDI = 100 * (smoothMinus / smoothTR);
    const dx = 100 * Math.abs(pDI - mDI) / (pDI + mDI || 1);

    if (i === period * 2) {
      out[i] = dx; // Seed
    } else if (i > period * 2) {
      out[i] = (out[i - 1] * (period - 1) + dx) / period;
    }
  }
  return out;
}

/**
 * Wilder's Relative Strength Index (RSI).
 * Seeds with SMA of gains/losses over the first `period` changes, then Wilder-smooths.
 * Indices [0, period-1] are NaN (insufficient data).
 */
export function rsiSeries(candles: Candle[], period = 14): number[] {
  const n = candles.length;
  const out = new Array(n).fill(NaN);
  if (n < period + 1) return out;

  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff > 0) gain += diff; else loss -= diff;
  }
  gain /= period; loss /= period;
  out[period] = 100 - (100 / (1 + (gain / (loss || 0.00001))));

  for (let i = period + 1; i < n; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    gain = (gain * (period - 1) + g) / period;
    loss = (loss * (period - 1) + l) / period;
    out[i] = 100 - (100 / (1 + (gain / (loss || 0.00001))));
  }
  return out;
}