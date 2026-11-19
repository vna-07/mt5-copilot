import { NextRequest, NextResponse } from "next/server";
import { getStatus, sessionOpenUnix } from "@/lib/session";
import { WATCHLIST, bySymbol } from "@/lib/watchlist";
import { getProvider, type Timeframe } from "@/lib/data/provider";
import { runScan } from "@/lib/scanners";
import { buildPlan } from "@/lib/risk";
import { buildMt5Steps } from "@/lib/mt5";
import type { Mode, Signal } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Settings for each mode (Timeframe, ATR multiplier, Min Risk/Reward)
const MODE_CFG: Record<Mode, { ltf: Timeframe; atrMult: number; minRr: number }> = {
  scalp: { ltf: "5min", atrMult: 1.0, minRr: 1.5 },
  intraday: { ltf: "15min", atrMult: 1.5, minRr: 2.0 },
  synthetic: { ltf: "5min", atrMult: 1.5, minRr: 1.5 },
};

// REDUCED to 2. (2 symbols * 2 timeframes = 4 API calls per scan. Safe for free tier).
const MAX_SYMBOLS = 2;

export async function GET(req: NextRequest) {
  // 1. Sanitize & Validate Inputs
  const modeParam = req.nextUrl.searchParams.get("mode") ?? "intraday";
  const validModes = ["scalp", "intraday", "synthetic"];
  const mode: Mode = validModes.includes(modeParam) ? (modeParam as Mode) : "intraday";
  
  const rawBalance = Number(req.nextUrl.searchParams.get("balance") ?? 1000);
  const balance = isNaN(rawBalance) || rawBalance <= 0 ? 1000 : rawBalance;

  const rawRisk = Number(req.nextUrl.searchParams.get("risk") ?? 1);
  const riskPercent = isNaN(rawRisk) || rawRisk <= 0 || rawRisk > 5 ? 1 : rawRisk;

  const cfg = MODE_CFG[mode];

  const now = new Date();
  const status = getStatus(now);

  // 2. Guardrail: Dead zone / weekend lockout
  if (mode !== "synthetic" && !status.scalpingEnabled) {
    return NextResponse.json({
      signal: null,
      note: status.note,
      provider: getProvider().name,
      status,
    }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } });
  }

  // 3. Select Candidates
  const candidates = mode === "synthetic"
    ? WATCHLIST.filter((i) => i.category === "synthetic")
    : status.recommended.map(bySymbol).filter((i): i is NonNullable<typeof i> => Boolean(i)).slice(0, MAX_SYMBOLS);

  if (!candidates.length) {
    return NextResponse.json({
      signal: null,
      note: "No tradable symbol for this session right now.",
      provider: getProvider().name,
      status,
    }, { headers: { "Cache-Control": "public, s-maxage=60" } });
  }

  const provider = getProvider();
  const nowTs = Math.floor(now.getTime() / 1000);
  const openTs = mode === "scalp" ? sessionOpenUnix(status.active[0]?.key ?? "ny", now) : 0;

  // 4. Run the scanner (with error tracking)
  let fetchErrors = 0;
  
  const results = await Promise.allSettled(
    candidates.map(async (inst) => {
      try {
        const [htf, ltf] = await Promise.all([
          provider.fetchCandles(inst, "1h", 220),
          provider.fetchCandles(inst, cfg.ltf, 320),
        ]);
        
        const raw = runScan({ mode, inst, htf, ltf, sessionOpenTs: openTs, nowTs });
        if (!raw || raw.confidence < 0.7) return null;

        const currentPrice = ltf[ltf.length - 1].close;
        const plan = buildPlan({
          instrument: inst,
          direction: raw.direction,
          entryLow: raw.entryLow,
          entryHigh: raw.entryHigh,
          atr: raw.atr,
          currentPrice,
          accountBalance: balance,
          riskPercent,
          atrMultiplier: cfg.atrMult,
          minRr: cfg.minRr,
        });

        return {
          id: `${inst.symbol}-${raw.direction}-${raw.setup.replace(/\s+/g, "")}-${ltf[ltf.length - 1].time}`,
          symbol: inst.symbol,
          mt5Symbol: inst.mt5Symbol,
          name: inst.name,
          digits: inst.digits,
          setup: raw.setup,
          mode,
          orderType: plan.orderType,
          direction: raw.direction,
          entryLow: plan.entryLow,
          entryHigh: plan.entryHigh,
          entryMid: plan.entryMid,
          sl: plan.sl,
          tp1: plan.tp1,
          tp2: plan.tp2,
          lotSize: plan.lotSize,
          riskUsd: plan.riskUsd,
          actualRiskUsd: plan.actualRiskUsd,
          slPips: plan.slPips,
          rrTp1: plan.rrTp1,
          maxSpread: inst.maxSpread,
          reasons: raw.reasons,
          warnings: plan.warnings,
          steps: buildMt5Steps(plan, inst),
          candles: ltf.slice(-140),
          confidence: raw.confidence,
          createdAt: Date.now(),
        } satisfies Signal;
      } catch (err) {
        fetchErrors++;
        console.error(`Scan failed for ${inst.symbol}:`, err);
        return null;
      }
    })
  );

  // 5. Process Results
  const signals = results
    .filter((r): r is PromiseFulfilledResult<Signal | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((s): s is Signal => Boolean(s))
    .sort((a, b) => b.confidence - a.confidence);

  const signal = signals[0] ?? null;
  
  // If all symbols failed due to network/API errors, warn the user
  const allFailed = fetchErrors === candidates.length;
  const note = allFailed ? "Data feed error. Check API keys or connection." 
             : signal ? null 
             : "No setup yet — scanning…";

  // 6. Return with Edge Caching
  // (s-maxage=15 means Vercel will cache this exact request for 15 seconds. 
  // This protects your API limits if multiple people open the app).
  return NextResponse.json(
    {
      signal,
      note,
      provider: provider.name,
      status,
      scanned: candidates.map((c) => c.symbol),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
      },
    }
  );
}