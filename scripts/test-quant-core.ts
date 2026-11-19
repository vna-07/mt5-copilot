// scripts/test-quant-core.ts
import { runScan } from "../lib/scanners";
import { buildPlan } from "../lib/risk";
import { buildMt5Steps } from "../lib/mt5";
import { bySymbol } from "../lib/watchlist";
import type { Candle } from "../lib/types";

let failed = 0;
function assert(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    console.log(`✓ ${name}`);
  } else {
    console.log(`✗ ${name}` + (detail ? ` → ${JSON.stringify(detail)}` : ""));
    failed++;
  }
}

// 1. Fabricate a textbook uptrend (H1)
const inst = bySymbol("EURUSD")!;
const htf: Candle[] = [];
let p = 1.0800;
for (let i = 0; i < 220; i++) {
  p += 0.0001;
  htf.push({ time: i * 3600, open: p, high: p + 0.0002, low: p - 0.0002, close: p });
}

// 2. Fabricate LTF (M15) with a strong uptrend (85 bars)
const ltf: Candle[] = [];
p = 1.0900;
for (let i = 0; i < 85; i++) {
  p += 0.0005;
  ltf.push({ time: 100000 + i * 900, open: p, high: p + 0.0005, low: p - 0.0001, close: p });
}
// Pullback into the 20 EMA
p -= 0.0020;
ltf.push({ time: 100000 + 85 * 900, open: p + 0.0010, high: p + 0.0010, low: p - 0.0002, close: p });
// Bullish rejection candle 
p -= 0.0004; 
ltf.push({ time: 100000 + 86 * 900, open: p + 0.0004, high: p + 0.0010, low: p - 0.0004, close: p + 0.0008 });

// 3. Run the 4-Stage Scanner
const raw = runScan({
  mode: "intraday",
  inst,
  htf,
  ltf,
  sessionOpenTs: 0,
  nowTs: Date.now() / 1000,
  activeTrades: [],
  currentSpread: 0.1,
});

assert("Scanner detects the trend pullback via 4-Stage Pipeline", raw !== null);

if (raw) {
  assert("Direction is BUY", raw.direction === "BUY");
  assert("Setup name is correct", raw.setup === "Trend Value Pullback");
  assert("Confluence score >= 75", raw.confidence >= 75);

  // 4. Calculate Risk Plan (Account: $1,000, Risk: 1%)
  const plan = buildPlan({
    instrument: inst,
    direction: raw.direction,
    entryLow: raw.entryLow,
    entryHigh: raw.entryHigh,
    atr: raw.atr,
    currentPrice: ltf[ltf.length - 1].close,
    accountBalance: 1000,
    riskPercent: 1,
    atrMultiplier: 1.5,
    minRr: 2.0,
  });

  assert("Calculated TP1 is above Entry", plan.tp1 > plan.entryMid);
  assert("Calculated SL is below Entry", plan.sl < plan.entryMid);
  assert("Lot size is valid (>= 0.01)", plan.lotSize >= 0.01);

  // 5. Generate MT5 Guide
  const steps = buildMt5Steps(plan, inst);
  assert("Generated exactly 4 MT5 steps", steps.length === 4);
  
  console.log("\n--- SAMPLE TRADE SIGNAL ---");
  console.log(`Symbol: ${inst.symbol}`);
  console.log(`Direction: ${plan.direction}`);
  console.log(`Entry: ${plan.entryMid}`);
  console.log(`SL: ${plan.sl} (${plan.slPips} pips)`);
  console.log(`TP1: ${plan.tp1}`);
  console.log(`Lot Size: ${plan.lotSize.toFixed(2)} (Risk: $${plan.actualRiskUsd})`);
  console.log(`Confluence Score: ${raw.confidence}/100`);
  console.log("---------------------------\n");
}

if (failed > 0) process.exit(1);
else console.log("✓ all quant core checks passed.");