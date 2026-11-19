import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <main className="ambient grid min-h-dvh place-items-center p-6">
      <div className="bento w-full max-w-sm text-center flex flex-col items-center">
        <div className="h-16 w-16 rounded-full bg-violet-400/10 flex items-center justify-center mb-4">
          <Compass className="text-violet-300" size={32} strokeWidth={1.5} />
        </div>
        <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold tracking-widest text-violet-300 uppercase mb-3">
          404
        </span>
        <h1 className="text-xl font-bold text-slate-50">Off the chart, Mbali</h1>
        <p className="text-sm text-slate-400 mt-2 mb-6">
          This page doesn't exist, and no trades were affected.
        </p>
        <Link 
          href="/"
          className="w-full rounded-2xl bg-[#f8fafc] text-black py-3.5 font-bold text-sm active:scale-95 transition"
        >
          Back to Live SAST Co-Pilot →
        </Link>
      </div>
    </main>
  );
}