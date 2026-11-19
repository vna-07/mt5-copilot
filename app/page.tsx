import { getStatus } from "@/lib/session";

export default function Home() {
  // Call our foundation engine directly on the server!
  const status = getStatus(); 

  return (
    <main className="ambient mx-auto max-w-md p-6 pt-12">
      <div className="bento">
        <h1 className="text-xl font-bold text-slate-50">Foundation Verified ✓</h1>
        <p className="mt-2 text-sm text-slate-400">
          The quant engine is running. Here is the live server-side SAST clock:
        </p>
        
        <div className="mt-6 flex items-center justify-between rounded-2xl bg-black/40 p-4 border border-white/10">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Live SAST Time</p>
            <p className="font-mono text-2xl font-bold text-slate-100">{status.sast.clock}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Session Status</p>
            <p className={`text-sm font-bold ${status.deadZone ? 'text-rose-400' : 'text-emerald-400'}`}>
              {status.deadZone ? "DEAD ZONE" : (status.active[0]?.label || "BETWEEN SESSIONS")}
            </p>
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Recommended pairs right now: <span className="text-violet-300 font-mono">{status.recommended.join(" · ") || "None"}</span>
        </p>
      </div>
    </main>
  );
}