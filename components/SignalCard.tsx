"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TradeChart from "./TradeChart";
import { useSoundEffects } from "@/lib/audio";
import type { Signal } from "@/lib/types";
import { Check, Copy, Lock, X, ChevronDown, ShieldCheck } from "lucide-react";

const f = (v: number, d: number) => v.toFixed(d);

export default function SignalCard({
  signal,
  isOffline,
  onPlaced,
}: {
  signal: Signal;
  isOffline: boolean;
  onPlaced: () => void;
}) {
  const [checks, setChecks] = useState({ session: false, risk: false, mindset: false });
  const [showGuide, setShowGuide] = useState(false);
  const { play } = useSoundEffects();
  const unlocked = checks.session && checks.risk && checks.mindset;
  const d = signal.digits;

  const copy = async (val: string) => {
    if (isOffline) return;
    try {
      await navigator.clipboard.writeText(val);
      play("copy", "copy");
    } catch {}
  };

  const Tile = ({ label, value, tone }: { label: string; value: string, tone?: "mint"|"coral" }) => (
    <button
      onClick={() => copy(value)}
      disabled={isOffline}
      className={`tile group relative transition-all duration-300 ${isOffline ? "opacity-45 grayscale cursor-not-allowed" : ""}`}
    >
      <p className="label">{label}</p>
      <p className={`num mt-1 text-xl font-bold ${tone === 'mint' ? 'text-mint' : tone === 'coral' ? 'text-coral' : 'text-alabaster'}`}>
        {value}
      </p>
      <div className="flex items-center gap-1.5 mt-2 opacity-60 group-hover:opacity-100 transition">
        {isOffline ? <Lock size={12} className="text-slate-400" /> : <Copy size={12} className="text-lavender" />}
        <p className="text-[9px] text-slate-400 font-medium tracking-widest uppercase">
          {isOffline ? "Locked" : "Tap to copy"}
        </p>
      </div>
    </button>
  );

  return (
    <div className="space-y-3 relative">
      {/* Guidance Banner */}
      <div className="bento bg-gradient-to-br from-pearl to-transparent border-rose-pearl p-4">
        <p className="text-sm font-semibold text-alabaster leading-relaxed">
          <span className={signal.direction === "BUY" ? "text-mint" : "text-coral"}>{signal.direction} {signal.symbol}</span> — {signal.setup}.
          <br />
          <span className="text-xs text-slate-400 font-normal mt-1 block">
            {signal.direction === "BUY"
              ? "Price is bouncing off a safe floor. Let the green line lock in profit, and the red line protect your balance."
              : "Price rejected a ceiling. Let the green line lock in profit, and the red line protect your balance."}
          </span>
        </p>
      </div>

      <div className="bento">
        <TradeChart id={signal.id} candles={signal.candles} entry={signal.entryMid} sl={signal.sl} tp1={signal.tp1} tp2={signal.tp2} />

        <div className="grid grid-cols-2 gap-2 mt-4">
          <Tile label="Lot Size" value={signal.lotSize.toFixed(2)} />
          <Tile label="Entry Price" value={f(signal.entryMid, d)} />
          <Tile label="Safety Exit" value={f(signal.sl, d)} tone="coral" />
          <Tile label="Profit Target" value={f(signal.tp1, d)} tone="mint" />
        </div>

        <div className="mt-3 flex justify-between rounded-xl bg-black/30 p-3 text-xs border border-white/5">
          <div><span className="text-slate-500">Risk:</span> <span className="num text-alabaster">${signal.actualRiskUsd.toFixed(2)}</span></div>
          <div><span className="text-slate-500">RR:</span> <span className="num text-mint">1:{signal.rrTp1}</span></div>
        </div>

        {/* Placed Button — notifies parent to move this into the babysitter */}
        <button
          onClick={() => { play("unlock", "unlock"); onPlaced(); }}
          className="w-full mt-3 flex items-center justify-center gap-2 rounded-xl bg-mint/10 border border-mint/30 py-3 text-sm font-bold text-mint transition-all hover:bg-mint/20 active:scale-95"
        >
          <ShieldCheck size={16} /> I've Placed This Trade on MT5
        </button>

        {/* Why Dropdown */}
        <details className="mt-3 group">
          <summary className="flex items-center justify-between cursor-pointer p-3 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-400 group-open:rounded-b-none group-open:border-b-transparent transition-all">
            Why did the bot take this?
            <ChevronDown size={14} className="group-open:rotate-180 transition-transform" />
          </summary>
          <div className="p-3 rounded-b-xl bg-white/5 border border-white/10 border-t-0 text-xs text-slate-400 leading-relaxed space-y-2">
            {signal.reasons.map((r, i) => (
              <p key={i} className="flex gap-2">
                <span className="text-lavender">•</span> {r}
              </p>
            ))}
          </div>
        </details>
      </div>

      <div className="bento">
        <p className="label">Discipline Check</p>
        <div className="mt-2 space-y-2">
          {[
            { k: "session", t: "Session & news clear" },
            { k: "risk", t: `1% risk verified (${signal.lotSize.toFixed(2)} lots)` },
            { k: "mindset", t: "Calm mindset (no FOMO)" }
          ].map((c) => (
            <button key={c.k} onClick={() => { play("click", "click"); setChecks(p => ({...p, [c.k]: !p[c.k as keyof typeof checks]})); }} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${checks[c.k as keyof typeof checks] ? "border-lavender/40 bg-lavender/10" : "border-white/10"}`}>
              <div className={`grid h-5 w-5 place-items-center rounded-md border transition ${checks[c.k as keyof typeof checks] ? "bg-lavender border-lavender text-black" : "border-white/20"}`}>
                {checks[c.k as keyof typeof checks] && <Check size={14} strokeWidth={3} />}
              </div>
              <span className="text-sm text-alabaster">{c.t}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Trigger for Slide-Up MT5 Guide */}
      <button
        onClick={() => { if(unlocked) { play("unlock", "unlock"); setShowGuide(true); } }}
        disabled={!unlocked}
        className={`w-full rounded-2xl py-4 font-bold text-sm transition-all duration-300 ${
          unlocked ? "bg-lavender text-canvas shadow-lg shadow-lavender/20 active:scale-95" : "bg-white/5 text-slate-500 cursor-not-allowed"
        }`}
      >
        {unlocked ? "Open Step-by-Step MT5 Guide →" : "Tick all 3 checks to unlock"}
      </button>

      {/* Slide-Up Bottom Sheet */}
      <AnimatePresence>
        {showGuide && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowGuide(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-[32px] border-t border-white/10 bg-canvas p-6 pb-12 shadow-2xl"
            >
              <div className="mx-auto w-12 h-1.5 rounded-full bg-white/20 mb-6" />

              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-alabaster">MT5 Mobile Execution</h3>
                <button onClick={() => setShowGuide(false)} className="p-2 bg-white/5 rounded-full text-slate-400"><X size={18} /></button>
              </div>

              <div className="space-y-4">
                {signal.steps.map((step, i) => (
                  <div key={i} className="rounded-2xl bg-pearl p-4 border border-white/5">
                    <p className="text-xs font-bold text-lavender mb-1">{step.title}</p>
                    <p className="text-sm text-slate-300 leading-relaxed">{step.body}</p>
                    {step.copy && (
                      <button onClick={() => copy(step.copy!)} className="mt-3 inline-flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg text-xs text-alabaster hover:bg-white/20 transition">
                        <Copy size={12} /> Copy {step.copy}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}