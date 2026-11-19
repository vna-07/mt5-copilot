// lib/watchlist.ts
// The 7 instruments we scan. Every field is used — verify pipValuePerLot
// and pipSize against your broker before real money.

import type { Instrument } from "./types";

export const WATCHLIST: Instrument[] = [
  {
    symbol: "EURUSD",
    mt5Symbol: "EURUSD",
    name: "Euro / US Dollar",
    category: "forex",
    digits: 5,
    pipSize: 0.0001,
    pipValuePerLot: 10,      // ≈ $10 / pip per 1.00 lot
    minLot: 0.01,
    lotStep: 0.01,
    maxSpread: 1.5,
    sessions: ["london", "ny"],
    dataSymbol: "EUR/USD",
  },
  {
    symbol: "GBPUSD",
    mt5Symbol: "GBPUSD",
    name: "British Pound / US Dollar",
    category: "forex",
    digits: 5,
    pipSize: 0.0001,
    pipValuePerLot: 10,
    minLot: 0.01,
    lotStep: 0.01,
    maxSpread: 2.0,
    sessions: ["london"],
    dataSymbol: "GBP/USD",
  },
  {
    symbol: "USDJPY",
    mt5Symbol: "USDJPY",
    name: "US Dollar / Japanese Yen",
    category: "forex",
    digits: 3,
    pipSize: 0.01,
    pipValuePerLot: 6.7,     // ≈ $6.70 / pip at ~150 USD/JPY
    minLot: 0.01,
    lotStep: 0.01,
    maxSpread: 1.8,
    sessions: ["asian", "ny"],
    dataSymbol: "USD/JPY",
  },
  {
    symbol: "XAUUSD",
    mt5Symbol: "XAUUSD",
    name: "Gold / US Dollar",
    category: "commodity",
    digits: 2,
    pipSize: 0.01,           // 1 "point" on gold = 0.01
    pipValuePerLot: 1,       // 1.00 lot × 0.01 move = $1
    minLot: 0.01,
    lotStep: 0.01,
    maxSpread: 30,           // 30 points = $0.30
    sessions: ["london", "ny"],
    dataSymbol: "XAU/USD",
  },
  {
    symbol: "US100",
    mt5Symbol: "US100",
    name: "Nasdaq 100 Index",
    category: "index",
    digits: 1,
    pipSize: 1,              // 1 index point
    pipValuePerLot: 1,
    minLot: 0.01,
    lotStep: 0.01,
    maxSpread: 2.5,
    sessions: ["ny"],
    dataSymbol: "NDX",
  },
  {
    symbol: "V25",
    mt5Symbol: "Volatility 25 Index",
    name: "Deriv Volatility 25",
    category: "synthetic",
    digits: 2,
    pipSize: 0.01,
    pipValuePerLot: 1,       // PLACEHOLDER — confirm in Deriv MT5 → Specification
    minLot: 0.01,
    lotStep: 0.01,
    maxSpread: 5,
    sessions: ["deadzone"],
    dataSymbol: "V25",
  },
  {
    symbol: "STEP",
    mt5Symbol: "Step Index",
    name: "Deriv Step Index",
    category: "synthetic",
    digits: 2,
    pipSize: 0.1,            // Step Index ticks in 0.1 increments
    pipValuePerLot: 1,       // PLACEHOLDER — confirm in Deriv MT5 → Specification
    minLot: 0.01,
    lotStep: 0.01,
    maxSpread: 5,
    sessions: ["deadzone"],
    dataSymbol: "STEP",
  },
];

export const SYNTHETICS = WATCHLIST.filter((i) => i.category === "synthetic");

/** Look up by app symbol, e.g. "EURUSD". Returns undefined if unknown. */
export function bySymbol(symbol: string): Instrument | undefined {
  return WATCHLIST.find((i) => i.symbol === symbol);
}