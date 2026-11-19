import type { Instrument, Mt5Step } from "./types";
import type { RiskPlan } from "./risk";

const f = (v: number, d: number) => v.toFixed(d);

export function buildMt5Steps(plan: RiskPlan, inst: Instrument): Mt5Step[] {
  const d = inst.digits;
  const halfLot = (plan.lotSize / 2).toFixed(2);
  const isSynthetic = inst.category === "synthetic";

  return [
    {
      title: "1. Find the Symbol",
      body: `Open MT5 Mobile → tap Quotes → tap the + icon (top right). Search "${inst.mt5Symbol}". Tap it to add it, then go back and scroll to the bottom of your Quotes list.`,
    },
    {
      title: "2. Place Order 1 (TP1 - Safe Target)",
      body: `Tap ${inst.mt5Symbol} → New Order. Set Volume to ${halfLot}. Paste SL: ${f(plan.sl, d)}. Paste TP: ${f(plan.tp1, d)}. Tap ${plan.direction} by Market.`,
      copy: `Vol: ${halfLot} | SL: ${f(plan.sl, d)} | TP: ${f(plan.tp1, d)}`
    },
    {
      title: "3. Place Order 2 (TP2 - Extended Runner)",
      body: `Tap ${inst.mt5Symbol} → New Order again. Set Volume to ${halfLot}. Paste SL: ${f(plan.sl, d)}. Paste TP: ${f(plan.tp2, d)}. Tap ${plan.direction} by Market.`,
      copy: `Vol: ${halfLot} | SL: ${f(plan.sl, d)} | TP: ${f(plan.tp2, d)}`
    },
    {
      title: "4. Babysitting & Breakeven",
      body: `When the app pings you that TP1 is hit, Order 1 closes automatically. Open MT5 → Trade tab → long-press Order 2 → Modify Position → paste Entry: ${f(plan.entryMid, d)} into the SL box. This trade is now 100% risk-free.`,
    },
  ];
}