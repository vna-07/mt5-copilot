"use client";
import { useCallback, useRef, useState, useEffect } from "react";

type Tone = { freq: number; start: number; dur: number; gain?: number; type?: OscillatorType };

const PRESETS: Record<string, Tone[]> = {
  click: [{ freq: 800, start: 0, dur: 0.025, gain: 0.08, type: "sine" }],
  // Crystal Confirmation Bell: C6 (1046Hz) -> G6 (1568Hz)
  copy: [
    { freq: 1046.50, start: 0.00, dur: 0.10, gain: 0.12, type: "sine" },
    { freq: 1568.00, start: 0.08, dur: 0.14, gain: 0.12, type: "sine" },
  ],
  // Unlock: F5 - A5 - C6
  unlock: [
    { freq: 698.46, start: 0.00, dur: 0.15, gain: 0.10, type: "triangle" },
    { freq: 880.00, start: 0.10, dur: 0.15, gain: 0.10, type: "triangle" },
    { freq: 1046.50, start: 0.20, dur: 0.20, gain: 0.10, type: "triangle" },
  ],
  // SAST Shift: D5+A5 -> E5+B5
  session: [
    { freq: 587.33, start: 0.00, dur: 0.25, gain: 0.10, type: "sine" },
    { freq: 880.00, start: 0.00, dur: 0.25, gain: 0.08, type: "sine" },
    { freq: 659.25, start: 0.25, dur: 0.30, gain: 0.10, type: "sine" },
    { freq: 987.77, start: 0.25, dur: 0.30, gain: 0.08, type: "sine" },
  ],
  // Offline / Stale Price
  offline: [
    { freq: 293.66, start: 0.00, dur: 0.15, gain: 0.08, type: "sine" },
    { freq: 220.00, start: 0.10, dur: 0.20, gain: 0.08, type: "sine" },
  ]
};

const HAPTICS = {
  click: 10,
  copy: [14, 28, 22],
  unlock: [18, 35, 25],
  session: [35, 55, 35, 55, 70],
  offline: [100, 50, 100],
};

export function useSoundEffects() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("copilot:muted") === "1") setMuted(true);
  }, []);

  const play = useCallback((name: keyof typeof PRESETS, haptic?: keyof typeof HAPTICS) => {
    if (haptic && typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { navigator.vibrate(HAPTICS[haptic]); } catch {}
    }
    if (muted) return;
    
    if (!ctxRef.current) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      ctxRef.current = new AC();
    }
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    
    const now = ctx.currentTime;
    for (const tone of PRESETS[name] ?? []) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = tone.type ?? "sine";
      osc.frequency.value = tone.freq;
      const g = tone.gain ?? 0.1;
      gain.gain.setValueAtTime(0, now + tone.start);
      gain.gain.linearRampToValueAtTime(g, now + tone.start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.start + tone.dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + tone.start);
      osc.stop(now + tone.start + tone.dur + 0.05);
    }
  }, [muted]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      localStorage.setItem("copilot:muted", next ? "1" : "0");
      return next;
    });
  }, []);

  return { play, muted, toggleMute };
}