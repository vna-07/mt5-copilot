import { NextRequest, NextResponse } from "next/server";
import { getStatus, sessionOpenUnix } from "@/lib/session";
import { WATCHLIST, bySymbol } from "@/lib/watchlist";
import { getProvider, type Timeframe } from "@/lib/data/provider";
import { runScan } from "@/lib/scanners";
import { buildPlan } from "@/lib/risk";
import { buildMt5Steps } from "@/lib/mt5";
import type { Mode, Signal } from "@/lib/types";
import { readSettings } from "@/lib/settings";
import { fetchEconomicEvents, findNewsBlackout } from "@/lib/news";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Settings for each mode (Timeframe, ATR multiplier, Min Risk/Reward)
const MODE_CFG: Record<Mode, { ltf: Timeframe; atrMult: number; minRr: number }> = {
  scalp: { ltf: "5min", atrMult: 1.0, minRr: 1.5 },
  intraday: { ltf: "15min", atrMult: 1.5, minRr: 2.0 },
  swing: { ltf: "4h", atrMult: 2.0, minRr: 2.5 },
  synthetic: { ltf: "5min", atrMult: 1.5, minRr: 1.5 },
};

// Correlation groups — overlapping USD exposure triggers risk halving
const USD_CORRELATED = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "US100"];

// Raised from 2 → 4 per the multi-trade spec. (4 symbols × 2 TF = 8 API calls
// per scan — stay under your free-tier quota if this grows further.)
const MAX_SYMBOLS = 4;

export async function GET(req: NextRequest) {
  // 1. Sanitize & Validate Inputs
  const modeParam = req.nextUrl.searchParams.get("mode") ?? "intraday";
  const validModes = ["scalp", "intraday", "swing", "synthetic"];
  const mode: Mode = validModes.includes(modeParam) ? (modeParam as Mode) : "intraday";

  const settings = readSettings(req);
  const balanceUsd = settings.currency === "ZAR"
    ? settings.balance / settings.exchangeRateZarPerUsd
    : settings.balance;
  const riskPercent = settings.riskPercent;

  // Active trades — comma-separated app symbols, e.g. "EURUSD,XAUUSD"
  const activeTradesParam = req.nextUrl.searchParams.get("activeTrades") ?? "";
  const activeTrades = activeTradesParam
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  const cfg = MODE_CFG[mode];

  const now = new Date();
  const status = getStatus(now);

  // 2. Guardrail: Dead zone / weekend lockout
  if (mode !== "synthetic" && !status.scalpingEnabled) {
    return NextResponse.json({
      signals: [],
      signal: null,
      note: status.note,
      provider: getProvider().name,
      status,
    }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } });
  }

  // 3. Select Candidates
  const candidates = mode === "synthetic"
    ? WATCHLIST.filter((i) => i.category === "synthetic")
    : status.recommended
        .map(bySymbol)
        .filter((i): i is NonNullable<typeof i> => Boolean(i))
        .filter((i) => !i.brokerProfiles || i.brokerProfiles.includes(settings.brokerProfile))
        .slice(0, MAX_SYMBOLS);

  if (!candidates.length) {
    return NextResponse.json({
      signals: [],
      signal: null,
      note: "No tradable symbol for this session right now.",
      provider: getProvider().name,
      status,
    }, { headers: { "Cache-Control": "public, s-maxage=60" } });
  }

  const provider = getProvider();
  const nowTs = Math.floor(now.getTime() / 1000);
  const economicEvents = await fetchEconomicEvents();
  const newsLocked: string[] = [];
  // Session anchor only matters for scalp VWAP; other modes use full-series VWAP.
  const openTs = mode === "scalp" ? sessionOpenUnix(status.active[0]?.key ?? "ny", now) : 0;

  // 4. Run the scanner (with error tracking)
  let fetchErrors = 0;

  const results = await Promise.allSettled(
    candidates.map(async (inst) => {
      try {
        const newsBlackout = findNewsBlackout(economicEvents, inst, now);
        if (newsBlackout) {
          newsLocked.push(inst.symbol);
          return null;
        }
        const [htf, ltf] = await Promise.all([
          provider.fetchCandles(inst, mode === "swing" ? "4h" : "1h", 220),
          provider.fetchCandles(inst, cfg.ltf, 320),
        ]);
        const quote = provider.fetchQuote ? await provider.fetchQuote(inst) : null;
        const liveSpread = quote ? Math.abs(quote.ask - quote.bid) : null;
        const currentSpread = liveSpread ?? inst.maxSpread * 0.2;
        const spreadStatus = liveSpread ? "LIVE" : provider.spreadStatus;

        const raw = runScan({
          mode, inst, htf, ltf,
          sessionOpenTs: openTs,
          nowTs,
          activeTrades,
          currentSpread,
          maxOpenTrades: settings.maxOpenTrades,
        });
        if (!raw || raw.confidence < 0.7) return null;

        // Correlation guard: halve risk if we already hold correlated USD exposure.
        // Skipped for crypto (not USD-correlated in the intraday sense).
        let effectiveRisk = riskPercent;
        if (inst.category !== "crypto" && activeTrades.some((t) => USD_CORRELATED.includes(t))) {
          effectiveRisk = riskPercent * 0.5;
        }

        const currentPrice = ltf[ltf.length - 1].close;
        const plan = buildPlan({
          instrument: inst,
          direction: raw.direction,
          entryLow: raw.entryLow,
          entryHigh: raw.entryHigh,
          atr: raw.atr,
          currentPrice,
          accountBalance: balanceUsd,
          riskPercent: effectiveRisk,
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
          spreadType: (liveSpread ? "LIVE" : "ESTIMATED") as "LIVE" | "ESTIMATED",
          spread: currentSpread,
        } satisfies Signal;
      } catch (err) {
        fetchErrors++;
        console.error(`Scan failed for ${inst.symbol}:`, err);
        return null;
      }
    })
  );

  // 5. Process Results — sort by confidence, highest confluence first
  const signals = results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.status === "fulfilled" && r.value ? [r.value as Signal] : [])
    .sort((a, b) => b.confidence - a.confidence);

  // Backward-compat: keep `signal` as the top-ranked one.
  // Once page.tsx migrates to the `signals` array, this can be removed.
  const signal = signals[0] ?? null;

  const allFailed = fetchErrors === candidates.length;
  const note = allFailed ? "Data feed error. Check API keys or connection."
             : newsLocked.length === candidates.length ? "High-impact news blackout — no new entries."
             : signal ? null
             : "No setup yet — scanning…";

  // 6. Return with Edge Caching.
  // NOTE: cache key now varies by activeTrades — different users with different
  // open positions get separate cache entries. Good (no cross-contamination),
  // but means the cache warms more slowly under multi-user load.
  return NextResponse.json(
    {
      signals,
      signal,                 // ← kept for backward compat with page.tsx
      note,
      provider: provider.name,
      status,
      scanned: candidates.map((c) => c.symbol),
      activeTrades,
      riskAdjusted: activeTrades.length > 0,
      newsLocked,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
      },
    }
  );
}