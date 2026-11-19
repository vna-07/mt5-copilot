// lib/mt5.ts
import type { Instrument, Mt5Step } from "./types";
import type { RiskPlan } from "./risk";

const f = (v: number, d: number) => v.toFixed(d);

export function buildMt5Steps(plan: RiskPlan, inst: Instrument): Mt5Step[] {
  const d = inst.digits;
  const unit = inst.category === "forex" ? "pips" : "points";
  const orderLabel = plan.orderType === "MARKET" ? "Market Execution" : plan.direction === "BUY" ? "Buy Limit" : "Sell Limit";

  return [
    {
      title: "1. Open the order ticket",
      body: `Open MT5 Mobile → tap Quotes at the bottom → find ${inst.mt5Symbol} → tap it → New Order.`,
      copy: inst.mt5Symbol,
    },
    {
      title: "2. Order type & lot size",
      body: `Select ${orderLabel}. In the Volume box, enter ${plan.lotSize.toFixed(2)} lots.`,
      copy: plan.lotSize.toFixed(2),
    },
    {
      title: "3. Paste Stop Loss & Take Profit",
      body: `Tap the SL box (red underline) and enter ${f(plan.sl, d)} → tap the TP box (green underline) and enter ${f(plan.tp1, d)}.`,
      copy: `${f(plan.sl, d)} / ${f(plan.tp1, d)}`,
    },
    {
      title: "4. Confirm, then manage",
      body: `Check the spread is below ${inst.maxSpread} ${unit}. Tap ${plan.direction}. When price reaches ${f(plan.tp1, d)}: go to Trade → press and hold the position → Modify → move SL to ${f(plan.entryMid, d)} (breakeven).`,
    },
  ];
}