// lib/types.ts
// Shared types for the whole app. No logic in here — just shapes.

export type Mode = "scalp" | "intraday" | "synthetic";
export type ModeOrSwing = Mode | "swing";

export type Direction = "BUY" | "SELL";

export type SessionKey = "asian" | "london" | "ny" | "deadzone";

/** A single OHLCV bar. `time` is unix seconds (UTC). */
export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

/**
 * A tradable instrument with MT5 broker specifics.
 *
 * pipSize         — price units per "pip" / "point" (0.0001 FX, 0.01 gold, 1 index)
 * pipValuePerLot  — USD per pip per 1.00 standard lot (VERIFY in MT5 → Specification)
 * maxSpread       — max acceptable spread in the same units as pipSize
 */
export type Instrument = {
  symbol: string;
  mt5Symbol: string;
  name: string;
  category: "forex" | "commodity" | "index" | "synthetic";
  digits: number;
  pipSize: number;
  pipValuePerLot: number;
  minLot: number;
  lotStep: number;
  maxSpread: number;
  sessions: SessionKey[];
  dataSymbol: string;
};

/** One step in the MT5 Mobile walkthrough. */
export type Mt5Step = {
  title: string;
  body: string;
  copy?: string;
};

/** A fully-resolved, ready-to-display trade signal. */
export type Signal = {
  id: string;
  symbol: string;
  mt5Symbol: string;
  name: string;
  digits: number;
  setup: string;
  mode: Mode;
  orderType: "MARKET" | "LIMIT";
  direction: Direction;
  entryLow: number;
  entryHigh: number;
  entryMid: number;
  sl: number;
  tp1: number;
  tp2: number;
  lotSize: number;
  riskUsd: number;
  actualRiskUsd: number;
  slPips: number;
  rrTp1: number;
  maxSpread: number;
  reasons: string[];
  warnings: string[];
  steps: Mt5Step[];
  candles: Candle[];
  confidence: number;
  createdAt: number;
};