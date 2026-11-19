"use client";
import { useEffect, useState } from "react";

type Entry = { id: string; at: number; symbol: string; outcome: string; };

export default function JournalPage() {
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem("copilot:journal");
    if (raw) setEntries(JSON.parse(raw));
  }, []);

  const addLog = (outcome: "won" | "lost" | "skipped") => {
    // Pull the last trade we saw from LocalStorage
    const lastSignal = localStorage.getItem("copilot:lastSignal");
    const draft = lastSignal ? JSON.parse(lastSignal) : { symbol: "UNKNOWN" };
    
    const entry: Entry = {
      id: Date.now().toString(),
      at: Date.now(),
      symbol: draft.symbol,
      outcome
    };
    const next = [entry, ...entries];
    setEntries(next);
    localStorage.setItem("copilot:journal", JSON.stringify(next));
  };

  return (
    <main className="ambient mx-auto max-w-md pb-28 px-3 pt-6">
      <h1 className="text-xl font-bold text-slate-50 mb-4">Discipline Journal</h1>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <button onClick={() => addLog("won")} className="rounded-2xl bg-emerald-500/20 border border-emerald-500/30 py-4 font-bold text-emerald-400 active:scale-95 transition">
          I Won (+R)
        </button>
        <button onClick={() => addLog("lost")} className="rounded-2xl bg-rose-500/20 border border-rose-500/30 py-4 font-bold text-rose-400 active:scale-95 transition">
          I Lost (-R)
        </button>
        <button onClick={() => addLog("skipped")} className="col-span-2 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm text-slate-300 active:scale-95 transition">
          I Skipped (No FOMO)
        </button>
      </div>

      <div className="space-y-2">
        {entries.map((e) => (
          <div key={e.id} className="bento flex justify-between items-center p-3">
            <div>
              <p className="font-bold text-slate-200">{e.symbol}</p>
              <p className="text-[10px] text-slate-500">{new Date(e.at).toLocaleString("en-ZA")}</p>
            </div>
            <span className={`px-2 py-1 rounded text-[10px] font-bold ${
              e.outcome === "won" ? "bg-emerald-500/20 text-emerald-300" : 
              e.outcome === "lost" ? "bg-rose-500/20 text-rose-300" : "bg-slate-700 text-slate-300"
            }`}>
              {e.outcome.toUpperCase()}
            </span>
          </div>
        ))}
        {entries.length === 0 && <p className="text-center text-xs text-slate-500 mt-8">No trades logged yet.</p>}
      </div>
    </main>
  );
}