// lib/data/provider.ts
import type { Candle, Instrument } from "../types";
import { roundTo } from "../indicators";
import WebSocket from "ws";

export type Timeframe = "1min" | "5min" | "15min" | "1h" | "4h";

export interface DataProvider {
  name: string;
  spreadStatus: "LIVE" | "ESTIMATED" | "UNVERIFIED";
  fetchCandles(inst: Instrument, tf: Timeframe, count: number): Promise<Candle[]>;
  fetchQuote?(inst: Instrument): Promise<{ bid: number; ask: number } | null>;
}

const tfSec = (tf: Timeframe) => (tf === "4h" ? 14400 : tf === "1h" ? 3600 : tf === "15min" ? 900 : tf === "5min" ? 300 : 60);
const UPSTREAM_TIMEOUT_MS = 12_000;

async function fetchUpstream(input: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

const BASE: Record<string, number> = { EURUSD: 1.085, GBPUSD: 1.27, USDJPY: 150.2, EURJPY: 165.2, AUDJPY: 98.5, GBPJPY: 188.4, XAUUSD: 2350, US100: 18500, US500: 5200, GER40: 18200, BTCUSD: 65000, ETHUSD: 3500, SOLUSD: 150, V25: 2500, STEP: 9000 };

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
  spreadStatus: "ESTIMATED",
  async fetchCandles(inst, tf, count) { return mockCandles(inst, tf, count); }
};

const cache = new Map<string, { at: number; data: Candle[] }>();
const inFlight = new Map<string, Promise<Candle[]>>();
const TTL = 55_000;

const twelve: DataProvider = {
  name: "twelvedata",
  spreadStatus: "ESTIMATED",
  async fetchCandles(inst, tf, count) {
    const key = process.env.TWELVEDATA_API_KEY!;
    const ck = `${inst.symbol}:${tf}`;
    const hit = cache.get(ck);
    if (hit && Date.now() - hit.at < TTL && hit.data.length >= count) {
      return hit.data.slice(-count);
    }

    const pending = inFlight.get(ck);
    if (pending) {
      const data = await pending;
      return data.slice(-count);
    }

    const request = (async () => {
      const outputsize = Math.max(count, 320);
      const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(inst.dataSymbol)}&interval=${tf}&outputsize=${outputsize}&timezone=UTC&apikey=${key}`;
      const res = await fetchUpstream(url, { headers: { Authorization: `Token ${key}` } });
      const json = await res.json();

      if (json.status === "error" || !json.values?.length) {
        throw new Error(`twelvedata error: ${json.message}`);
      }

      const data: Candle[] = json.values.map((v: any) => ({
        time: Math.floor(Date.parse(v.datetime.replace(" ", "T") + "Z") / 1000),
        open: Number(v.open), high: Number(v.high), low: Number(v.low), close: Number(v.close), volume: v.volume ? Number(v.volume) : 1,
      })).sort((a: any, b: any) => a.time - b.time);

      cache.set(ck, { at: Date.now(), data });
      return data;
    })();

    inFlight.set(ck, request);
    try {
      const data = await request;
      return data.slice(-count);
    } finally {
      inFlight.delete(ck);
    }
  },
};

const tiingo: DataProvider = {
  name: "tiingo",
  spreadStatus: "ESTIMATED",
  async fetchCandles(inst, tf, count) {
    const key = process.env.TIINGO_FOREX_API_KEY;
    if (!key) throw new Error("TIINGO_FOREX_API_KEY is not configured");
    const resampleFreq = tf === "4h" ? "4hour" : tf === "1h" ? "1hour" : tf;
    const startDate = new Date(Date.now() - tfSec(tf) * count * 1.25 * 1000).toISOString();
    const ticker = inst.dataSymbol.replace("/", "").toLowerCase();
    const url = `https://api.tiingo.com/tiingo/fx/${encodeURIComponent(ticker)}/prices?startDate=${encodeURIComponent(startDate)}&resampleFreq=${resampleFreq}`;
    const res = await fetchUpstream(url, { headers: { Authorization: `Token ${key}` } });
    const json = await res.json();

    if (!res.ok || !Array.isArray(json) || !json.length) {
      throw new Error(`tiingo error: ${json?.detail || json?.message || res.statusText}`);
    }

    return json.map((v: any) => ({
      time: Math.floor(Date.parse(v.date) / 1000),
      open: roundTo(Number(v.open), inst.digits),
      high: roundTo(Number(v.high), inst.digits),
      low: roundTo(Number(v.low), inst.digits),
      close: roundTo(Number(v.close), inst.digits),
      volume: v.volume ? Number(v.volume) : 1,
    })).sort((a: Candle, b: Candle) => a.time - b.time).slice(-count);
  },
  async fetchQuote(inst) {
    const key = process.env.TIINGO_FOREX_API_KEY;
    if (!key) return null;
    const ticker = inst.dataSymbol.replace("/", "").toLowerCase();
    const res = await fetchUpstream(
      `https://api.tiingo.com/tiingo/fx/${encodeURIComponent(ticker)}/top`,
      { headers: { Authorization: `Token ${key}` } }
    );
    const json = await res.json();
    const quote = Array.isArray(json) ? json[0] : json;
    const bid = Number(quote?.bidPrice);
    const ask = Number(quote?.askPrice);
    return Number.isFinite(bid) && Number.isFinite(ask) ? { bid, ask } : null;
  },
};

const DERIV_SYMBOLS: Record<string, string> = {
  V25: "1HZ25V",
  STEP: "stpRNG",
  BTCUSD: "cryBTCUSD",
  ETHUSD: "cryETHUSD",
  SOLUSD: "SOLUSD",
};

function derivSymbol(inst: Instrument): string | undefined {
  return DERIV_SYMBOLS[inst.symbol];
}

async function derivRequest(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const appId = process.env.DERIV_APP_ID;
  if (!appId) throw new Error("DERIV_APP_ID is not configured");
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(appId)}`);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("Deriv WebSocket timeout"));
    }, 12_000);
    socket.on("open", () => socket.send(JSON.stringify(payload)));
    socket.on("message", (raw) => {
      try {
        const json = JSON.parse(raw.toString()) as Record<string, unknown>;
        if (json.error) {
          clearTimeout(timeout);
          socket.close();
          reject(new Error(String((json.error as Record<string, unknown>).message ?? "Deriv error")));
          return;
        }
        clearTimeout(timeout);
        socket.close();
        resolve(json);
      } catch (error) {
        clearTimeout(timeout);
        socket.close();
        reject(error);
      }
    });
    socket.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

const deriv: DataProvider = {
  name: "deriv",
  spreadStatus: "LIVE",
  async fetchCandles(inst, tf, count) {
    const symbol = derivSymbol(inst);
    if (!symbol) throw new Error(`Deriv has no verified symbol mapping for ${inst.symbol}`);
    const granularity = tf === "4h" ? 14400 : tf === "1h" ? 3600 : tf === "15min" ? 900 : tf === "5min" ? 300 : 60;
    const json = await derivRequest({
      ticks_history: symbol,
      style: "candles",
      granularity,
      count,
      end: "latest",
    });
    const candles = (json.candles as Array<Record<string, unknown>> | undefined) ?? [];
    return candles.map((c) => ({
      time: Number(c.epoch),
      open: roundTo(Number(c.open), inst.digits),
      high: roundTo(Number(c.high), inst.digits),
      low: roundTo(Number(c.low), inst.digits),
      close: roundTo(Number(c.close), inst.digits),
      volume: 1,
    }));
  },
  async fetchQuote(inst) {
    const symbol = derivSymbol(inst);
    if (!symbol) return null;
    const json = await derivRequest({ ticks: symbol, subscribe: 0 });
    const tick = json.tick as Record<string, unknown> | undefined;
    if (!tick || !Number.isFinite(Number(tick.quote))) return null;
    const quote = Number(tick.quote);
    const spread = inst.category === "synthetic" ? inst.maxSpread * 0.1 : inst.pipSize;
    return { bid: quote - spread / 2, ask: quote + spread / 2 };
  },
};

const twelveOrDeriv: DataProvider = {
  name: "mixed",
  spreadStatus: "ESTIMATED",
  async fetchCandles(inst, tf, count) {
    if (inst.category === "synthetic" || inst.category === "crypto") {
      if (derivSymbol(inst)) return deriv.fetchCandles(inst, tf, count);
    }
    return twelve.fetchCandles(inst, tf, count);
  },
  async fetchQuote(inst) {
    if (derivSymbol(inst)) return deriv.fetchQuote?.(inst) ?? null;
    return null;
  },
};

const tiingoOrDeriv: DataProvider = {
  name: "tiingo/deriv",
  spreadStatus: "ESTIMATED",
  async fetchCandles(inst, tf, count) {
    if (inst.category === "synthetic" || inst.category === "crypto") {
      if (derivSymbol(inst)) return deriv.fetchCandles(inst, tf, count);
      return twelve.fetchCandles(inst, tf, count);
    }
    if (inst.category === "forex" || inst.category === "commodity") {
      return tiingo.fetchCandles(inst, tf, count);
    }
    return twelve.fetchCandles(inst, tf, count);
  },
  async fetchQuote(inst) {
    if (derivSymbol(inst)) return deriv.fetchQuote?.(inst) ?? null;
    if (inst.category === "forex" || inst.category === "commodity") {
      return tiingo.fetchQuote?.(inst) ?? null;
    }
    return null;
  },
};

export function getProvider(): DataProvider {
  if (process.env.TIINGO_FOREX_API_KEY && process.env.DERIV_APP_ID) return tiingoOrDeriv;
  if (process.env.DERIV_APP_ID && process.env.TWELVEDATA_API_KEY) return twelveOrDeriv;
  if (process.env.DERIV_APP_ID) return deriv;
  if (process.env.TIINGO_FOREX_API_KEY) return tiingo;
  return process.env.TWELVEDATA_API_KEY ? twelve : mockProvider;
}