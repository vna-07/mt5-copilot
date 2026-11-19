// lib/risk.ts
import type { Direction, Instrument } from "./types";
import { roundTo } from "./indicators";

export type RiskPlan = {
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
  warnings: string[];
};

export function buildPlan(args: {
  instrument: Instrument; direction: Direction; entryLow: number; entryHigh: number; atr: number;
  currentPrice: number; accountBalance: number; riskPercent: number; atrMultiplier: number; minRr: number;
}): RiskPlan {
  const { instrument: inst, direction, entryLow, entryHigh, atr, currentPrice, accountBalance, riskPercent, atrMultiplier, minRr } = args;
  const d = inst.digits;
  const entryMid = (entryLow + entryHigh) / 2;
  const riskDist = Math.max(atr * atrMultiplier, inst.pipSize * 3);

  const sl = direction === "BUY" ? entryMid - riskDist : entryMid + riskDist;
  const tp1 = direction === "BUY" ? entryMid + riskDist * minRr : entryMid - riskDist * minRr;
  const tp2 = direction === "BUY" ? entryMid + riskDist * (minRr + 1) : entryMid - riskDist * (minRr + 1);

  const slPips = Math.abs(entryMid - sl) / inst.pipSize;
  const riskUsd = accountBalance * (riskPercent / 100);
  const rawLots = riskUsd / (slPips * inst.pipValuePerLot);

  let lotSize = Math.floor(rawLots / inst.lotStep) * inst.lotStep;
  lotSize = Math.max(inst.minLot, Number(lotSize.toFixed(2)));

  const actualRiskUsd = lotSize * slPips * inst.pipValuePerLot;
  const warnings: string[] = [];

  if (actualRiskUsd > riskUsd * 1.15) {
    warnings.push(`Minimum lot size (${inst.minLot.toFixed(2)}) means you risk ≈ $${actualRiskUsd.toFixed(2)} (${((actualRiskUsd / accountBalance) * 100).toFixed(1)}%), not your ${riskPercent}% target.`);
  }
  if (slPips < 4 && inst.category === "forex") {
    warnings.push("Stop is under 4 pips — spread and slippage will dominate.");
  }

  const orderType: "MARKET" | "LIMIT" = direction === "BUY" ? (currentPrice <= entryHigh ? "MARKET" : "LIMIT") : (currentPrice >= entryLow ? "MARKET" : "LIMIT");

  return {
    orderType, direction, entryLow: roundTo(entryLow, d), entryHigh: roundTo(entryHigh, d), entryMid: roundTo(entryMid, d),
    sl: roundTo(sl, d), tp1: roundTo(tp1, d), tp2: roundTo(tp2, d), lotSize, riskUsd: Number(riskUsd.toFixed(2)),
    actualRiskUsd: Number(actualRiskUsd.toFixed(2)), slPips: Number(slPips.toFixed(1)), rrTp1: minRr, warnings,
  };
}