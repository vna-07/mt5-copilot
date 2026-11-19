// scripts/test-quant-core.ts
import { trendPullback } from "../lib/scanners";
import { buildPlan } from "../lib/risk";
import { buildMt5Steps } from "../lib/mt5";
import { bySymbol } from "../lib/watchlist";
import type { Candle } from "../lib/types";

let failed = 0;
function assert(name: string, cond: boolean, detail?: unknown) {
  if (cond) console.log(`✓ ${name}`);
  else { console.log(`✗ ${name}` + (detail ? ` → ${JSON.stringify(detail)}` : "")); failed++; }
}

// 1. Fabricate a perfect uptrend with a pullback
const inst = bySymbol("EURUSD")!;
const htf: Candle[] = []; const ltf: Candle[] = [];
let p = 1.0800;

for (let i = 0; i < 220; i++) { p += 0.0001; htf.push({ time: i * 3600, open: p, high: p+0.0002, low: p-0.0002, close: p }); }
// LTF: Strong uptrend for 75 bars, then a pullback to the 20 EMA, then a bullish rejection
for (let i = 0; i < 75; i++) { p += 0.0002; ltf.push({ time: 100000 + i*300, open: p, high: p+0.0003, low: p-0.0001, close: p }); }
// Pullback (price drops) + rejection wick
p -= 0.0010; ltf.push({ time: 100000 + 75*300, open: p+0.0005, high: p+0.0006, low: p-0.0005, close: p+0.0004 });

// 2. Run the Scanner
const raw = trendPullback(inst, htf, ltf);
assert("Scanner detects the trend pullback", raw !== null);

if (raw) {
  assert("Direction is BUY", raw.direction === "BUY");
  assert("Setup name is correct", raw.setup === "Trend Pullback");

  // 3. Calculate Risk Plan (Account: $1,000, Risk: 1%)
  const plan = buildPlan({
    instrument: inst, direction: raw.direction, entryLow: raw.entryLow, entryHigh: raw.entryHigh,
    atr: raw.atr, currentPrice: ltf[ltf.length-1].close, accountBalance: 1000, riskPercent: 1,
    atrMultiplier: 1.5, minRr: 2.0,
  });

  assert("Calculated TP1 is above Entry", plan.tp1 > plan.entryMid);
  assert("Calculated SL is below Entry", plan.sl < plan.entryMid);
  assert("Lot size is valid (>= 0.01)", plan.lotSize >= 0.01);
  assert("Actual risk is close to $10 target", plan.actualRiskUsd <= 11.5);

  // 4. Generate MT5 Guide
  const steps = buildMt5Steps(plan, inst);
  assert("Generated exactly 4 MT5 steps", steps.length === 4);
  assert("Step 1 contains the symbol", steps[0].body.includes("EURUSD"));
  assert("Step 3 has the Stop Loss", steps[2].body.includes(plan.sl.toFixed(5)));

  console.log("\n--- SAMPLE TRADE SIGNAL ---");
  console.log(`Symbol: ${inst.symbol}`);
  console.log(`Direction: ${plan.direction}`);
  console.log(`Entry: ${plan.entryMid}`);
  console.log(`SL: ${plan.sl} (${plan.slPips} pips)`);
  console.log(`TP1: ${plan.tp1}`);
  console.log(`Lot Size: ${plan.lotSize.toFixed(2)} (Risk: $${plan.actualRiskUsd})`);
  console.log("---------------------------\n");
}

if (failed > 0) process.exit(1);
else console.log("✓ all quant core checks passed.");