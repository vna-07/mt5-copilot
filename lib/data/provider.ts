// lib/data/provider.ts
import type { Candle, Instrument } from "../types";
import { roundTo } from "../indicators";

export type Timeframe = "5min" | "15min" | "1h";

export interface DataProvider {
  name: string;
  fetchCandles(inst: Instrument, tf: Timeframe, count: number): Promise<Candle[]>;
}

const tfSec = (tf: Timeframe) => (tf === "1h" ? 3600 : tf === "15min" ? 900 : 300);

const BASE: Record<string, number> = { EURUSD: 1.085, GBPUSD: 1.27, USDJPY: 150.2, XAUUSD: 2350, US100: 18500, V25: 2500, STEP: 9000 };

function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a: number) { return function() { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function mockCandles(inst: Instrument, tf: Timeframe, count: number): Candle[] {
  const step = tfSec(tf);
  const lastBar = Math.floor(Date.now() / 1000 / step) * step;
  const rand = mulberry32(hash(`${inst.symbol}:${tf}`));
  const base = BASE[inst.symbol] ?? 100;
  const sigma = base * (inst.category === "synthetic" ? 0.0016 : 0.0009) * Math.sqrt(step / 300);

  let price = base; let drift = 0; const out: Candle[] = [];
  for (let i = 0; i < count; i++) {
    if (i % 34 === 0) drift = (rand() - 0.5) * sigma * 0.6;
    const o = price; const c = o + drift + (rand() - 0.5) * 2 * sigma;
    const h = Math.max(o, c) + rand() * sigma * 0.6; const l = Math.min(o, c) - rand() * sigma * 0.6;
    out.push({ time: lastBar - (count - 1 - i) * step, open: roundTo(o, inst.digits), high: roundTo(h, inst.digits), low: roundTo(l, inst.digits), close: roundTo(c, inst.digits), volume: 100 + Math.round(rand() * 200) });
    price = c;
  }
  return out;
}

const mockProvider: DataProvider = {
  name: "demo",
  async fetchCandles(inst, tf, count) { return mockCandles(inst, tf, count); }
};

const cache = new Map<string, { at: number; data: Candle[] }>();
const TTL = 55_000;

const twelve: DataProvider = {
  name: "twelvedata",
  async fetchCandles(inst, tf, count) {
    const key = process.env.TWELVEDATA_API_KEY!;
    const ck = `${inst.symbol}:${tf}:${count}`;
    const hit = cache.get(ck);
    if (hit && Date.now() - hit.at < TTL) return hit.data;

    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(inst.dataSymbol)}&interval=${tf}&outputsize=${count}&timezone=UTC&apikey=${key}`;
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json();
    
    if (json.status === "error" || !json.values?.length) throw new Error(`twelvedata error: ${json.message}`);
    
    const data: Candle[] = json.values.map((v: any) => ({
      time: Math.floor(Date.parse(v.datetime.replace(" ", "T") + "Z") / 1000),
      open: Number(v.open), high: Number(v.high), low: Number(v.low), close: Number(v.close), volume: v.volume ? Number(v.volume) : 1,
    })).sort((a: any, b: any) => a.time - b.time);

    cache.set(ck, { at: Date.now(), data });
    return data;
  },
};

export function getProvider(): DataProvider {
  return process.env.TWELVEDATA_API_KEY ? twelve : mockProvider;
}