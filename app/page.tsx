"use client";
import { useEffect, useState, useCallback } from "react";
import SignalCard from "@/components/SignalCard";
import ActiveTradesDrawer from "@/components/ActiveTradesDrawer";
import SkeletonLoader from "@/components/SkeletonLoader";
import type { Signal } from "@/lib/types";
import type { AccountSettings } from "@/lib/settings";
import { Lock, Settings as SettingsIcon, X } from "lucide-react";

const MODES = [
  { key: "scalp", label: "Scalping" },
  { key: "intraday", label: "Intraday" },
  { key: "swing", label: "Swing" },
  { key: "synthetic", label: "Synthetics" },
] as const;

export default function Home() {
  const [mode, setMode] = useState<typeof MODES[number]["key"]>("intraday");
  const [signals, setSignals] = useState<Signal[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [activeTrades, setActiveTrades] = useState<string[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [scanning, setScanning] = useState(true);
  const [clock, setClock] = useState("");
  const [providerName, setProviderName] = useState("demo");
  const [newsLocked, setNewsLocked] = useState<string[]>([]);

  // Safety States
  const [isOffline, setIsOffline] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lastSaved, setLastSaved] = useState<Signal | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AccountSettings | null>(null);

  // 1. Live SAST Clock
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

  // 3. Network Connectivity Guard + Load persisted state
  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    if (!navigator.onLine) setIsOffline(true);

    // Load last saved setup (offline safety net)
    const saved = localStorage.getItem("copilot:lastSignal");
    if (saved) setLastSaved(JSON.parse(saved));

    // Load active trades (babysitter state)
    const trades = localStorage.getItem("copilot:activeTrades");
    if (trades) setActiveTrades(JSON.parse(trades));
    fetch("/api/settings")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => { if (json?.settings) setSettings(json.settings); })
      .catch(() => {});

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // 4. Scan API — now returns signals[]
  const scan = useCallback(async () => {
    setScanning(true);
    try {
      const res = await fetch(
        `/api/scan?mode=${mode}&activeTrades=${activeTrades.join(",")}`
      );
      if (!res.ok) throw new Error("Network response was not ok");
      const json = await res.json();

      const newSignals: Signal[] = json.signals ?? [];
      setSignals(newSignals);
      setStatus(json.status);
      setProviderName(json.provider ?? "demo");
      setNewsLocked(json.newsLocked ?? []);
      setIsOffline(false);

      // Clamp active index to valid range — preserves user's viewing position
      // across polls when possible, falls back to 0 if the queue shrank.
      setActiveIdx((prev) => newSignals.length === 0 ? 0 : Math.min(prev, newSignals.length - 1));

      // Keep the highest-confidence signal as the offline safety net
      if (newSignals[0]) {
        localStorage.setItem("copilot:lastSignal", JSON.stringify(newSignals[0]));
        setLastSaved(newSignals[0]);
      }
    } catch (e) {
      console.error(e);
      setIsOffline(true);
    } finally {
      setScanning(false);
    }
  }, [mode, activeTrades]);

  useEffect(() => {
    scan();
    const int = setInterval(scan, 30000);
    return () => clearInterval(int);
  }, [scan]);

  // 5. Mark a signal as placed — moves it into the babysitter
  const markAsPlaced = (symbol: string) => {
    if (settings && activeTrades.length >= settings.maxOpenTrades) return;
    const next = [...activeTrades, symbol];
    setActiveTrades(next);
    localStorage.setItem("copilot:activeTrades", JSON.stringify(next));
    if (signal) {
      fetch("/api/trades", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trades: [{
            symbol,
            entry: signal.entryMid,
            sl: signal.sl,
            tp1: signal.tp1,
            tp2: signal.tp2,
            tp1Sent: false,
            tp2Sent: false,
            slSent: false,
            closed: false,
            updatedAt: Date.now(),
          }],
          directions: { [symbol]: signal.direction },
        }),
      }).catch(() => {});
    }

    // Remove from current queue + advance scanning state
    setScanning(true);
    setSignals((prev) => {
      const remaining = prev.filter((s) => s.symbol !== symbol);
      setActiveIdx((idx) => remaining.length === 0 ? 0 : Math.min(idx, remaining.length - 1));
      return remaining;
    });
  };

  const signal = signals[activeIdx] ?? null;

  const saveSettings = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: AccountSettings = {
      balance: Number(form.get("balance")),
      currency: form.get("currency") === "ZAR" ? "ZAR" : "USD",
      riskPercent: Number(form.get("riskPercent")),
      exchangeRateZarPerUsd: Number(form.get("exchangeRateZarPerUsd")),
      maxOpenTrades: Number(form.get("maxOpenTrades")),
      brokerProfile: form.get("brokerProfile") as AccountSettings["brokerProfile"],
    };
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    if (res.ok) {
      const json = await res.json();
      setSettings(json.settings);
      setShowSettings(false);
    }
  };

  const enablePush = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;
    const registration = await navigator.serviceWorker.ready;
    const keyRes = await fetch("/api/push");
    const keyJson = await keyRes.json();
    if (!keyJson.publicKey) return;
    const applicationServerKey = Uint8Array.from(
      atob(keyJson.publicKey.replace(/-/g, "+").replace(/_/g, "/"))
        .split("")
        .map((char) => char.charCodeAt(0))
    );
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
    await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
  };

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

          <button
            onClick={() => setShowSettings(true)}
            aria-label="Account settings"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-slate-400"
          >
            <SettingsIcon size={16} />
          </button>
        </div>
        <div className="mt-2 flex justify-end">
          <span className={`rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${
            providerName === "demo"
              ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
              : "border-mint/30 bg-mint/10 text-mint"
          }`}>
            {providerName === "demo" ? "Demo data • estimated spread" : "Twelve Data • estimated spread"}
          </span>
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

      {/* Multi-Signal Queue Pills */}
      {signals.length > 1 && (
        <div className="px-3 flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
          {signals.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setActiveIdx(i)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                i === activeIdx
                  ? "bg-violet-400/20 border-violet-400/40 text-violet-100"
                  : "bg-white/5 border-white/10 text-slate-400"
              }`}
            >
              {i + 1}. {s.symbol} {s.direction}
            </button>
          ))}
        </div>
      )}

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
              {newsLocked.length > 0
                ? `High-impact economic news blackout active for ${newsLocked.join(", ")}. No new entries are allowed for 15 minutes before through 10 minutes after the release.`
                : status?.deadZone
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
        {signal && (
          <SignalCard
            signal={signal}
            isOffline={isOffline}
            onPlaced={() => markAsPlaced(signal.symbol)}
          />
        )}

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

      {/* The Babysitter Drawer */}
      <ActiveTradesDrawer activeTrades={activeTrades} setActiveTrades={setActiveTrades} />

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={saveSettings}
            className="w-full max-w-md rounded-t-[32px] border-t border-white/10 bg-canvas p-6 pb-24"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="label">Account Profile</p>
                <h2 className="mt-1 text-lg font-bold">Risk & Broker Settings</h2>
              </div>
              <button type="button" onClick={() => setShowSettings(false)} className="grid h-10 w-10 place-items-center rounded-full bg-white/5">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="tile">
                <span className="label">Currency</span>
                <select name="currency" defaultValue={settings?.currency ?? "USD"} className="mt-2 w-full bg-transparent text-sm text-alabaster">
                  <option value="USD">USD</option>
                  <option value="ZAR">ZAR</option>
                </select>
              </label>
              <label className="tile">
                <span className="label">Balance</span>
                <input name="balance" type="number" min="1" step="0.01" defaultValue={settings?.balance ?? 1000} className="mt-2 w-full bg-transparent text-sm text-alabaster" />
              </label>
              <label className="tile">
                <span className="label">Risk / Trade</span>
                <input name="riskPercent" type="number" min="0.1" max="5" step="0.1" defaultValue={settings?.riskPercent ?? 1} className="mt-2 w-full bg-transparent text-sm text-alabaster" />
              </label>
              <label className="tile">
                <span className="label">ZAR / USD</span>
                <input name="exchangeRateZarPerUsd" type="number" min="1" step="0.01" defaultValue={settings?.exchangeRateZarPerUsd ?? 18.5} className="mt-2 w-full bg-transparent text-sm text-alabaster" />
              </label>
              <label className="tile">
                <span className="label">Max Trades</span>
                <select name="maxOpenTrades" defaultValue={settings?.maxOpenTrades ?? 3} className="mt-2 w-full bg-transparent text-sm text-alabaster">
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>
              </label>
              <label className="tile">
                <span className="label">Broker Profile</span>
                <select name="brokerProfile" defaultValue={settings?.brokerProfile ?? "other"} className="mt-2 w-full bg-transparent text-sm text-alabaster">
                  <option value="other">Other / Verify</option>
                  <option value="deriv_financial">Deriv Financial</option>
                  <option value="deriv_derived">Deriv Derived</option>
                </select>
              </label>
            </div>

            <button type="submit" className="mt-5 w-full rounded-2xl bg-lavender py-4 text-sm font-bold text-canvas">
              Save Account Settings
            </button>
            <button type="button" onClick={enablePush} className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-slate-300">
              Enable Trade Notifications
            </button>
          </form>
        </div>
      )}
    </main>
  );
}