"use client";
import { useState } from "react";
import { ChevronUp, ChevronDown, Copy, ShieldCheck, CheckCircle2 } from "lucide-react";
import { useSoundEffects } from "@/lib/audio";

export default function ActiveTradesDrawer({ activeTrades, setActiveTrades }: { activeTrades: string[], setActiveTrades: (s: string[]) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const { play } = useSoundEffects();

  if (activeTrades.length === 0) return null;

  const closeTrade = (sym: string) => {
    const next = activeTrades.filter(s => s !== sym);
    setActiveTrades(next);
    localStorage.setItem("copilot:activeTrades", JSON.stringify(next));
    play("unlock", "unlock");
  };

  return (
    <div className="fixed bottom-20 inset-x-3 max-w-md mx-auto z-40">
      <div className="bento bg-canvas/95 backdrop-blur-xl border-white/20 overflow-hidden">
        
        <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-mint" size={18} />
            <span className="font-bold text-alabaster text-sm">Active Trades ({activeTrades.length})</span>
          </div>
          {isOpen ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronUp size={18} className="text-slate-400" />}
        </button>

        {isOpen && (
          <div className="px-4 pb-4 space-y-2 animate-in slide-in-from-bottom-2">
            {activeTrades.map(sym => (
              <div key={sym} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                <div>
                  <p className="font-bold text-alabaster text-sm">{sym}</p>
                  <p className="text-[10px] text-slate-400">Monitoring for TP1...</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => closeTrade(sym)} className="px-2 py-1 rounded bg-mint/20 text-mint text-[10px] font-bold">
                    Hit TP / Close
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}