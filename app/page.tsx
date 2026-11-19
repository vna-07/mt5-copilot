"use client";
import { useEffect, useState, useCallback } from "react";
import SignalCard from "@/components/SignalCard";
import SkeletonLoader from "@/components/SkeletonLoader";
import type { Signal } from "@/lib/types";
import { Lock } from "lucide-react";

const MODES = [
  { key: "scalp", label: "Scalping" },
  { key: "intraday", label: "Intraday" },
  { key: "synthetic", label: "Synthetics" },
] as const;

export default function Home() {
  const [mode, setMode] = useState<typeof MODES[number]["key"]>("intraday");
  const [signal, setSignal] = useState<Signal | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [scanning, setScanning] = useState(true);
  const [clock, setClock] = useState("");
  
  // Safety States
  const [isOffline, setIsOffline] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lastSaved, setLastSaved] = useState<Signal | null>(null);

  // 1. Live SAST Clock & Privacy Tracker
  useEffect(() => {
    const tick = () => {
      const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date());
      setClock(time);
    };
    tick();
    const int = setInterval(tick, 1000);
    return () => clearInterval(int);
  }, []);

  // 2. Privacy Auto-Lock (3 minutes hidden)
  useEffect(() => {
    let hiddenTime = 0;
    const handleVisibility = () => {
      if (document.hidden) {
        hiddenTime = Date.now();
      } else {
        if (hiddenTime && Date.now() - hiddenTime > 3 * 60 * 1000) {
          setIsLocked(true);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // 3. Network Connectivity Guard
  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    if (!navigator.onLine) setIsOffline(true);

    // Load last saved setup
    const saved = localStorage.getItem("copilot:lastSignal");
    if (saved) setLastSaved(JSON.parse(saved));

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // 4. Scan API
  const scan = useCallback(async () => {
    setScanning(true);
    try {
      const res = await fetch(`/api/scan?mode=${mode}&balance=1000&risk=1`);
      if (!res.ok) throw new Error("Network response was not ok");
      const json = await res.json();
      
      setSignal(json.signal);
      setStatus(json.status);
      setIsOffline(false);

      if (json.signal) {
        localStorage.setItem("copilot:lastSignal", JSON.stringify(json.signal));
        setLastSaved(json.signal);
      }
    } catch (e) {
      console.error(e);
      setIsOffline(true);
    } finally {
      setScanning(false);
    }
  }, [mode]);

  useEffect(() => {
    scan();
    const int = setInterval(scan, 30000);
    return () => clearInterval(int);
  }, [scan]);

  // Render Privacy Curtain
  if (isLocked) {
    return (
      <main className="ambient fixed inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-2xl bg-[#09090e]/80">
        <p className="num text-5xl font-bold text-slate-200">{clock}</p>
        <p className="text-xs text-slate-500 tracking-widest uppercase mt-2 mb-8">SAST</p>
        <button 
          onClick={() => setIsLocked(false)}
          className="pill flex items-center gap-2 bg-violet-500/20 text-violet-200 border-violet-400/30 px-6 py-3"
        >
          <Lock size={16} /> Unlock Co-Pilot
        </button>
      </main>
    );
  }

  return (
    <main className="ambient mx-auto max-w-md min-h-dvh pb-28">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 px-3 pt-3 pb-2 bg-[#09090e]/80 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="pill flex items-center gap-2">
            <span className="num text-sm font-bold">{clock}</span>
            <span className="text-[10px] text-slate-500">SAST</span>
          </div>
          
          <div className={`pill text-[10px] font-bold transition-colors duration-500 ${
            isOffline ? "text-amber-400 bg-amber-400/10 border-amber-400/20 animate-pulse" :
            status?.deadZone ? "text-rose-400" : "text-emerald-400"
          }`}>
            {isOffline ? "● Connection Paused" : status?.deadZone ? "DEAD ZONE" : (status?.active?.[0]?.label || "SCANNING")}
          </div>
        </div>
      </header>

      {/* Mode Tabs */}
      <div className="px-3 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold border transition ${
              mode === m.key ? "bg-violet-400/20 text-violet-100 border-violet-400/30" : "bg-white/5 text-slate-400 border-white/10"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="px-3 mt-2">
        {/* Fail-Safe Notice */}
        {isOffline && signal && (
          <div className="mb-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-200 animate-in fade-in">
            <strong>Prices paused while offline</strong> so you don't enter on stale numbers.
          </div>
        )}

        {/* Skeleton Loader */}
        {scanning && !signal && <SkeletonLoader />}

        {/* Anti-FOMO Standby Screen */}
        {!scanning && !signal && !isOffline && (
          <div className="bento text-center py-10 px-6 animate-in fade-in">
            <div className="h-12 w-12 rounded-full bg-lavender/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-xl">☕</span>
            </div>
            <p className="text-lg font-bold text-alabaster">Nothing to Do Right Now</p>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              {status?.deadZone 
                ? "Forex banks are closed and spreads are wide. The safest trade is no trade."
                : "The market is choppy or lacks clean volume right now. Stepping away protects your capital."}
            </p>
            {status?.upcoming?.[0] && (
              <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-4 py-2">
                <span className="text-xs text-slate-400">Next session:</span>
                <span className="text-xs font-bold text-lavender">
                  {status.upcoming[0].label} in {status.upcoming[0].startsIn}
                </span>
              </div>
            )}
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-6">I'll ping your phone when it's time.</p>
          </div>
        )}

        {/* Live Signal Card */}
        {signal && <SignalCard signal={signal} isOffline={isOffline} />}

        {/* Offline Safety Net (Read-only) */}
        {isOffline && lastSaved && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
            <p className="font-bold text-slate-400 mb-2 uppercase tracking-widest">Last Saved Setup</p>
            <div className="flex justify-between text-slate-300">
              <span>{lastSaved.symbol} {lastSaved.direction}</span>
              <span className="num">SL: {lastSaved.sl}</span>
              <span className="num">TP: {lastSaved.tp1}</span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}