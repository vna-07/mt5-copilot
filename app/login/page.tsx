"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSoundEffects } from "@/lib/audio";
import { Check, X, Delete } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { play } = useSoundEffects();
  
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // 1. Responsive Input (Keypad)
  const handleKeyPress = (num: string) => {
    if (status !== "idle" || code.length >= 4) return;
    play("login_click", "click");
    setCode((prev) => prev + num);
  };

  const handleDelete = () => {
    if (status !== "idle" || code.length === 0) return;
    play("login_click", "click");
    setCode((prev) => prev.slice(0, -1));
  };

  // Auto-submit on 4th digit
  useEffect(() => {
    if (code.length === 4 && status === "idle") {
      submitCode(code);
    }
  }, [code, status]);

  // 2. Verification Snap
  const submitCode = async (finalCode: string) => {
    setStatus("loading");
    play("login_hum");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: finalCode }),
      });
      
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        // Success
        setStatus("success");
        play("login_success", "unlock");
        // 4. Glass Veil Dissolve (wait 700ms for animation, then redirect)
        setTimeout(() => {
          window.location.href = params.get("next") || "/";
        }, 900);
      } else {
        // Error
        setStatus("error");
        play("login_error", "offline");
        setErrorMsg(data.error || "Incorrect passcode.");
        setTimeout(() => {
          setCode("");
          setStatus("idle");
        }, 800);
      }
    } catch (err) {
      setStatus("error");
      setErrorMsg("Server connection failed. Check Vercel env variables.");
      setTimeout(() => {
        setCode("");
        setStatus("idle");
      }, 1500);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ 
        opacity: 1, 
        y: 0,
        x: status === "error" ? [-8, 8, -5, 5, 0] : 0, // Shake on error
        scale: status === "success" ? 1.04 : 1,
        filter: status === "success" ? "blur(12px)" : "blur(0px)"
      }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className={`bento w-full max-w-sm text-center transition-colors duration-300 ${
        status === "error" ? "border-coral/50" : ""
      }`}
    >
      <p className="label">Private Access</p>
      <h1 className="mt-2 text-2xl font-bold text-alabaster">MT5 Co-Pilot</h1>
      
      {/* Passcode Dots */}
      <div className="mt-6 flex justify-center gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div 
            key={i} 
            className={`h-4 w-4 rounded-full border transition-all duration-300 ${
              code.length > i 
                ? "bg-lavender border-lavender shadow-[0_0_10px_rgba(196,181,253,0.6)]" 
                : "border-white/20 bg-white/5"
            }`}
          />
        ))}
      </div>

      {errorMsg && <p className="mt-3 text-xs text-coral">{errorMsg}</p>}

      {/* Keypad */}
      <div className={`grid grid-cols-3 gap-3 mt-8 transition-opacity duration-300 ${status !== "idle" ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            onClick={() => handleKeyPress(num.toString())}
            className="aspect-square rounded-full bg-white/5 border border-white/10 text-xl font-semibold text-alabaster hover:bg-white/10 active:scale-[0.94] transition-all"
          >
            {num}
          </button>
        ))}
        <div /> {/* Empty bottom-left */}
        <button
          onClick={() => handleKeyPress("0")}
          className="aspect-square rounded-full bg-white/5 border border-white/10 text-xl font-semibold text-alabaster hover:bg-white/10 active:scale-[0.94] transition-all"
        >
          0
        </button>
        <button
          onClick={handleDelete}
          className="aspect-square rounded-full flex items-center justify-center text-slate-400 hover:text-alabaster active:scale-[0.94] transition-all"
        >
          <Delete size={20} />
        </button>
      </div>

      {/* Button-to-Orb Morph & Snap */}
      <div className="h-16 mt-6 flex items-center justify-center relative">
        <AnimatePresence mode="wait">
          {status === "idle" && (
            <motion.div 
              key="idle-pill"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.8 }}
              className="text-xs text-slate-500 uppercase tracking-widest font-semibold"
            >
              Enter 4-digit code
            </motion.div>
          )}

          {status === "loading" && (
            <motion.div
              key="loading-orb"
              initial={{ scale: 0.5, borderRadius: "24px" }}
              animate={{ scale: 1, borderRadius: "50%" }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="h-12 w-12 border-2 border-lavender border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(196,181,253,0.4)]"
            />
          )}

          {status === "success" && (
            <motion.div
              key="success-pill"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-2 rounded-full bg-mint/20 border border-mint/30 px-4 py-2 text-mint font-bold"
            >
              <Check size={16} strokeWidth={3} /> Welcome back, Mbali
            </motion.div>
          )}

          {status === "error" && (
            <motion.div
              key="error-pill"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-2 rounded-full bg-coral/20 border border-coral/30 px-4 py-2 text-coral font-bold"
            >
              <X size={16} strokeWidth={3} /> Try again
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function LoginPage() {
  return (
    <main className="ambient fixed inset-0 z-50 flex flex-col items-center justify-center bg-canvas">
      {/* Ambient Glow (Brightens during loading per your spec) */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blush/10 via-canvas to-canvas" />
      
      <Suspense fallback={
        <div className="bento w-full max-w-sm text-center py-12">
          <p className="text-slate-400 animate-pulse">Loading secure portal…</p>
        </div>
      }>
        <LoginForm />
      </Suspense>
    </main>
  );
}