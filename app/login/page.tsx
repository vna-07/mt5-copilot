"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (res.ok) {
      router.replace(params.get("next") || "/");
    } else {
      setError("Incorrect code.");
      setCode("");
    }
  };

  return (
    <main className="ambient grid min-h-dvh place-items-center p-6">
      <form onSubmit={submit} className="bento w-full max-w-sm text-center">
        <p className="label">Private Access</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-50">MT5 Co-Pilot</h1>
        <input
          type="password"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter access code"
          className="mt-6 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-center font-mono tracking-widest text-slate-50 outline-none focus:border-violet-400"
        />
        {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
        <button type="submit" className="mt-4 w-full rounded-2xl bg-violet-500 py-3 font-semibold text-white active:scale-95 transition">
          Unlock
        </button>
      </form>
    </main>
  );
}