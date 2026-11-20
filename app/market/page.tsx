"use client";

import { useEffect, useState } from "react";
import TradeChart from "@/components/TradeChart";
import { BEGINNER_EXPLAINERS, buildPlainEnglishMarketStory } from "@/lib/beginnerGuide";
import { ChevronDown, Gauge, ShieldCheck, X } from "lucide-react";

type MarketData = {
  symbol: string;
  name: string;
  mt5Symbol: string;
  timeframe: string;
  provider: string;
  spreadSource: "LIVE" | "ESTIMATED";
  bid: number | null;
  ask: number | null;
  spread: number;
  spreadToAtrPct: number;
  candles: any[];
  overlays: { e20: number[]; e50: number[]; e200: number[]; vwap: number[]; upperVwapBand: number[]; lowerVwapBand: number[] };
  telemetry: {
    buyPressure: number;
    sellPressure: number;
    rvol: number;
    displacement: boolean;
    bullishFvg: boolean;
    bearishFvg: boolean;
    adx: number;
    atr: number;
    rsi: number;
    regime: "TRENDING" | "RANGING" | "CHAOTIC";
  };
  margin: {
    leverage: number;
    accountCurrency: "ZAR" | "USD";
    balance: number;
    lotSize: number;
    contractSize: number;
    pointValuePerLot: number;
    stopsLevel: number;
    requiredMarginUsd: number;
    requiredMarginZar: number;
    freeMarginUsd: number;
    marginSafe: boolean;
    verified: boolean;
  };
  symbols: Array<{ symbol: string; name: string }>;
};

export default function MarketPage() {
  const [symbol, setSymbol] = useState("XAUUSD");
  const [tf, setTf] = useState("M15");
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/market?symbol=${symbol}&tf=${tf}`)
      .then((res) => res.json())
      .then((json) => { if (active) setData(json); })
      .finally(() => { if (active) setLoading(false); });
    const interval = setInterval(() => {
      fetch(`/api/market?symbol=${symbol}&tf=${tf}`)
        .then((res) => res.json())
        .then((json) => setData(json));
    }, 30000);
    return () => { active = false; clearInterval(interval); };
  }, [symbol, tf]);

  const last = data?.candles[data.candles.length - 1];
  const story = data ? buildPlainEnglishMarketStory({
    symbol: data.name,
    regime: data.telemetry.regime,
    tickBuyPressurePct: data.telemetry.buyPressure,
    spreadSource: data.spreadSource,
    spreadToAtrPct: data.spreadToAtrPct,
    marginSafe: data.margin.marginSafe,
  }) : null;

  const dot = (state: "good" | "caution" | "bad") => (
    <span className={`inline-block h-2 w-2 rounded-full ${state === "good" ? "bg-mint" : state === "caution" ? "bg-amber-400" : "bg-coral"}`} />
  );

  return (
    <main className="ambient mx-auto max-w-md min-h-dvh px-3 pb-28 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="label">Live Market & Flow</p>
          <h1 className="mt-1 text-xl font-bold text-alabaster">Read the market calmly</h1>
        </div>
        <Gauge className="text-lavender" size={22} />
      </div>

      <section className="bento p-3">
        <div className="flex items-center gap-2">
          <label className="relative flex-1">
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="h-11 w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-3 pr-8 text-sm font-bold text-alabaster">
              {(data?.symbols || [{ symbol: "XAUUSD", name: "Gold / US Dollar" }]).map((item) => (
                <option key={item.symbol} value={item.symbol}>{item.symbol} - {item.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
          </label>
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto scrollbar-hide">
          {["M1", "M5", "M15", "H1", "H4"].map((item) => (
            <button key={item} onClick={() => setTf(item)} className={`h-10 shrink-0 rounded-xl border px-3 text-xs font-bold ${tf === item ? "border-lavender/40 bg-lavender/15 text-lavender" : "border-white/10 bg-white/5 text-slate-400"}`}>
              {item}
            </button>
          ))}
        </div>
        {data && (
          <div className="mt-2 flex flex-wrap gap-2 text-[9px] font-bold uppercase tracking-wider">
            <span className="rounded-full border border-mint/20 bg-mint/10 px-2 py-1 text-mint">Feed: {data.provider === "demo" ? "Demo" : "Live"}</span>
            <span className={`rounded-full border px-2 py-1 ${data.spreadSource === "LIVE" ? "border-mint/20 bg-mint/10 text-mint" : "border-amber-400/20 bg-amber-400/10 text-amber-300"}`}>
              Spread: {data.spreadSource} {typeof data.spread === "number" ? data.spread.toFixed(4) : ""}
            </span>
          </div>
        )}
      </section>

      {story && (
        <section className="bento mt-3 p-4">
          <p className="label">What's happening right now</p>
          <h2 className="mt-1 text-sm font-bold text-alabaster">{story.headline}</h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">{story.body}</p>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{story.costText}</p>
          <p className={`mt-2 text-xs font-semibold ${data?.margin.marginSafe ? "text-mint" : "text-coral"}`}>{story.safetyNote}</p>
        </section>
      )}

      <section className="bento mt-3 p-3">
        {loading && <p className="py-8 text-center text-xs text-slate-500">Loading market chart...</p>}
        {data && last && (
          <TradeChart
            id={`${symbol}-${tf}`}
            candles={data.candles}
            entry={last.close}
            sl={last.close - data.telemetry.atr * 1.5}
            tp1={last.close + data.telemetry.atr * 1.5 * 2}
            tp2={last.close + data.telemetry.atr * 1.5 * 3}
            overlays={data.overlays}
          />
        )}
        <div className="mt-3 rounded-xl border border-white/5 bg-white/[0.03] p-3 text-xs leading-relaxed text-slate-400">
          <b className="text-slate-200">How to read this:</b> Green bars mean price rose during the selected time block; red bars mean it fell. Thin wicks show where price was pushed back.
        </div>
      </section>

      {data && (
        <>
          <section className="mt-3 grid grid-cols-2 gap-2">
            {[
              { title: "Buyer or Seller Pressure", value: `${data.telemetry.buyPressure}% Buyers`, detail: data.telemetry.buyPressure >= 58 ? "Buyers pushing harder" : data.telemetry.buyPressure <= 42 ? "Sellers pushing harder" : "Fairly balanced" },
              { title: "Market Participation", value: `${data.telemetry.rvol.toFixed(2)}x`, detail: data.telemetry.rvol >= 1.4 ? "Activity surge" : "Normal activity" },
              { title: "Fast-Move Zone", value: data.telemetry.bullishFvg || data.telemetry.bearishFvg ? "Zone active" : "No open zone", detail: data.telemetry.displacement ? "Strong move candle" : "No strong displacement" },
              { title: "Market Mood", value: data.telemetry.regime === "TRENDING" ? "Strong Trend" : data.telemetry.regime === "RANGING" ? "Sideways Chop" : "Jumpy", detail: `Strength score ${data.telemetry.adx}` },
            ].map((tile) => (
              <div key={tile.title} className="bento p-3">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{tile.title}</p>
                <p className="mt-2 text-sm font-bold text-alabaster">{tile.value}</p>
                <p className="mt-1 text-[10px] text-slate-400">{tile.detail}</p>
              </div>
            ))}
          </section>

          <section className="bento mt-3 p-4">
            <div className="flex items-center justify-between">
              <p className="label">Trade Account Check</p>
              <ShieldCheck size={16} className={data.margin.marginSafe ? "text-mint" : "text-coral"} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="tile"><p className="label">Buying Power Boost</p><p className="num mt-1 font-bold">1:{data.margin.leverage}</p></div>
              <div className="tile"><p className="label">Trade Size</p><p className="num mt-1 font-bold">{data.margin.lotSize}</p></div>
              <div className="tile"><p className="label">Security Deposit</p><p className="num mt-1 font-bold">${data.margin.requiredMarginUsd}</p></div>
              <div className="tile"><p className="label">Free Safety Buffer</p><p className="num mt-1 font-bold">${data.margin.freeMarginUsd}</p></div>
            </div>
            <div className="mt-3 space-y-2 text-[11px] text-slate-400">
              <p>Contract size: <b className="text-slate-200">{data.margin.contractSize}</b> • Point value/lot: <b className="text-slate-200">{data.margin.pointValuePerLot}</b></p>
              <p>Minimum stop distance: <b className="text-slate-200">{data.margin.stopsLevel} points</b></p>
              <p>Broker data: <b className={data.margin.verified ? "text-mint" : "text-amber-300"}>{data.margin.verified ? "Broker Verified" : "Estimated - verify in MT5"}</b></p>
            </div>
          </section>

          <section className="mt-3 flex justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-[11px]">
            <span className="flex items-center gap-2">{dot(data.spreadToAtrPct <= 15 ? "good" : data.spreadToAtrPct <= 25 ? "caution" : "bad")} Broker Fee</span>
            <span className="flex items-center gap-2">{dot(data.telemetry.regime === "TRENDING" ? "good" : data.telemetry.regime === "RANGING" ? "caution" : "bad")} Market Mood</span>
            <span className="flex items-center gap-2">{dot(data.margin.marginSafe ? "good" : "bad")} Account Safety</span>
          </section>
        </>
      )}

      <button onClick={() => setShowGuide(true)} className="mt-3 w-full rounded-2xl border border-lavender/20 bg-lavender/10 py-3 text-sm font-bold text-lavender">
        ? What do these words mean?
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 bg-black/70 p-3 pt-16 backdrop-blur-sm">
          <div className="mx-auto max-w-md rounded-t-[32px] bg-canvas p-5 pb-24">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Pocket Cheat Sheet</h2>
              <button onClick={() => setShowGuide(false)} className="grid h-10 w-10 place-items-center rounded-full bg-white/5"><X size={18} /></button>
            </div>
            <div className="mt-4 max-h-[65vh] space-y-2 overflow-y-auto">
              {BEGINNER_EXPLAINERS.map((item) => (
                <details key={item.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <summary className="cursor-pointer text-sm font-bold text-alabaster">{item.simpleTitle}</summary>
                  <p className="mt-2 text-xs text-slate-300">{item.oneLiner}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{item.howItHelpsHer}</p>
                  <p className="mt-2 text-[9px] uppercase tracking-wider text-lavender">Also called: {item.proTerm}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
