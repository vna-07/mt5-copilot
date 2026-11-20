// lib/session.ts
// SAST (Africa/Johannesburg, UTC+2, no DST) session engine.
// Runs identically in the browser and in Node.

import type { SessionKey } from "./types";

const TZ = "Africa/Johannesburg";
const FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
});

export type SastParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  /** Minutes since SAST midnight */
  minutes: number;
  /** "15:32:07" */
  clock: string;
  /** "Mon 15/01" */
  dateLabel: string;
};

export function sastParts(date: Date = new Date()): SastParts {
  const parts = FMT.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;

  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    map.weekday ?? "Sun"
  );

  const hour = Number(map.hour);
  const minute = Number(map.minute);
  const second = Number(map.second);
  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekday,
    minutes: hour * 60 + minute,
    clock: `${map.hour}:${map.minute}:${map.second}`,
    dateLabel: `${map.weekday} ${map.day}/${map.month}`,
  };
}

export type SessionWindow = {
  key: SessionKey;
  label: string;
  startMin: number;      // SAST minutes
  endMin: number;        // SAST minutes (may wrap past midnight for deadzone)
  primeStartMin?: number;
  primeEndMin?: number;
  symbols: string[];     // app symbols
  tradeable: boolean;
  hint: string;
};

/**
 * Two-tier session model:
 *   - `active` = the session is live
 *   - `prime`  = the highest-probability window inside the active session
 *
 * London is 09:00–16:00 with prime 10:00–12:00.
 * NY is 15:30–22:00 with prime 15:30–18:30 (US cash open).
 */
export const SESSIONS: SessionWindow[] = [
  {
    key: "asian",
    label: "Asian Session",
    startMin: 120,          // 02:00 SAST
    endMin: 540,            // 09:00 SAST
    symbols: ["USDJPY"],
    tradeable: true,
    hint: "Calm range — USD/JPY mean-reversion only. Bot marks the Asian high/low for the London breakout.",
  },
  {
    key: "london",
    label: "London Session",
    startMin: 540,          // 09:00 SAST
    endMin: 870,            // 14:30 SAST
    primeStartMin: 600,     // 10:00 SAST
    primeEndMin: 720,       // 12:00 SAST
    symbols: ["EURUSD", "GBPUSD", "XAUUSD"],
    tradeable: true,
    hint: "Prime 10:00–12:00 SAST — Asian range sweeps and trend pullbacks.",
  },
  {
    key: "ny",
    label: "New York / Overlap",
    startMin: 870,          // 14:30 SAST
    endMin: 1320,           // 22:00 SAST
    primeStartMin: 930,     // 15:30 SAST
    primeEndMin: 1110,      // 18:30 SAST
    symbols: ["US100", "XAUUSD", "EURUSD", "USDJPY"],
    tradeable: true,
    hint: "Prime 15:30–18:30 SAST — momentum breakouts at the US cash open.",
  },
  {
    key: "deadzone",
    label: "Dead Zone / Rollover",
    startMin: 1380,         // 23:00 SAST
    endMin: 120,            // 02:00 SAST (wraps past midnight)
    symbols: [],
    tradeable: false,
    hint: "Spreads widen at broker rollover. No FX, gold or indices. V25 / Step Index only.",
  },
];

/** Handles overnight windows such as 23:00–02:00. */
function inWindow(min: number, start: number, end: number): boolean {
  return start <= end
    ? min >= start && min < end
    : min >= start || min < end;
}

function fmtDur(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0
    ? `${h}h ${String(m).padStart(2, "0")}m`
    : `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export type ActiveSession = {
  key: SessionKey;
  label: string;
  isPeak: boolean;
  hint: string;
};

export type UpcomingSession = {
  key: SessionKey;
  label: string;
  seconds: number;
  startsIn: string;
};

export type SessionStatus = {
  sast: SastParts;
  active: ActiveSession[];
  upcoming: UpcomingSession[];
  deadZone: boolean;
  forexOpen: boolean;
  scalpingEnabled: boolean;
  /** App symbols to scan right now (2–3 max). */
  recommended: string[];
  /** True when the app should show V25 / STEP instead of FX. */
  syntheticFallback: boolean;
  note: string;
};

export function getStatus(now: Date = new Date()): SessionStatus {
  const p = sastParts(now);
  const min = p.minutes;

  const activeWindows = SESSIONS.filter((s) =>
    inWindow(min, s.startMin, s.endMin)
  );
  const deadZone = activeWindows.some((s) => s.key === "deadzone");

  // FX week: closed Saturday all day, closed Sunday before 23:00 SAST,
  // closed Friday from 23:00 SAST onward (broker rollover into weekend).
  const forexOpen = !(
    p.weekday === 6 ||
    (p.weekday === 0 && min < 1380) ||
    (p.weekday === 5 && min >= 1380)
  );

  const active: ActiveSession[] = activeWindows
    .filter((s) => s.key !== "deadzone")
    .map((s) => ({
      key: s.key,
      label: s.label,
      isPeak:
        s.primeStartMin !== undefined &&
        s.primeEndMin !== undefined &&
        inWindow(min, s.primeStartMin, s.primeEndMin),
      hint: s.hint,
    }));

  const upcoming: UpcomingSession[] = SESSIONS.filter(
    (s) => s.key !== "deadzone" && !inWindow(min, s.startMin, s.endMin)
  )
    .map((s) => {
      // minutes until start, modulo 24h — handles wrap correctly
      const delta = (s.startMin - min + 1440) % 1440;
      const seconds = delta * 60 - p.second;
      return { key: s.key, label: s.label, seconds, startsIn: fmtDur(seconds) };
    })
    .filter((u) => u.seconds > 0 && u.seconds <= 3 * 3600)
    .sort((a, b) => a.seconds - b.seconds);

  const scalpingEnabled = forexOpen && !deadZone;

  let recommended: string[] = [];
  if (scalpingEnabled) {
    for (const s of activeWindows) {
      if (s.tradeable) recommended.push(...s.symbols);
    }
  }
  const syntheticFallback = !scalpingEnabled;
  if (syntheticFallback) recommended = ["V25", "STEP"];

  // Crypto trades 24/7 — always scan it, regardless of session state.
  // This keeps the app useful during the 22:00–23:00 SAST gap (no FX
  // session live) and gives a fallback when FX is quiet.
  recommended.push("BTCUSD", "ETHUSD", "SOLUSD");

  // Deduplicate while preserving order
  const seen = new Set<string>();
  recommended = recommended.filter((s) => {
    if (seen.has(s)) return false;
    seen.add(s);
    return true;
  });

  const note = !forexOpen
    ? "FX market closed (weekend). 24/7 Synthetics are available."
    : deadZone
    ? "Dead zone active — scalping paused to protect you from wide spreads."
    : "Scanning…";

  return {
    sast: p,
    active,
    upcoming,
    deadZone,
    forexOpen,
    scalpingEnabled,
    recommended,
    syntheticFallback,
    note,
  };
}

/**
 * Unix seconds (UTC) of today's (SAST) open for a session.
 * SAST is UTC+2 year-round, so we just subtract 2 hours from the SAST hour.
 * Returns 0 if the session isn't found. Sessions starting before 02:00 SAST
 * would need day-rollover handling — none of ours do.
 */
export function sessionOpenUnix(
  key: SessionKey,
  now: Date = new Date()
): number {
  const s = SESSIONS.find((x) => x.key === key);
  if (!s) return 0;
  const p = sastParts(now);
  const hourUtc = Math.floor(s.startMin / 60) - 2;
  const minuteUtc = s.startMin % 60;
  return Math.floor(
    Date.UTC(p.year, p.month - 1, p.day, hourUtc, minuteUtc) / 1000
  );
}

// -----------------------------------------------------------------------------
// "What to trade now" — the top Bento card copy
// -----------------------------------------------------------------------------

export type WhatToTradeNow = {
  headline: string;
  regime: "trade" | "prepare" | "avoid";
  tone: "mint" | "amber" | "coral" | "lavender";
  detail: string;
};

export function buildWhatToTradeNow(
  status: SessionStatus,
  activeSignalSymbol: string | null
): WhatToTradeNow {
  if (!status.forexOpen) {
    return {
      headline: "Forex closed — trade V25 / Step Index",
      regime: "trade",
      tone: "lavender",
      detail:
        "24/7 Synthetics are the cleanest practice right now. 50 EMA on M15, pullback entries on M5, 1:2 RR.",
    };
  }
  if (status.deadZone) {
    return {
      headline: "Dead zone — Forex locked",
      regime: "avoid",
      tone: "coral",
      detail:
        "Spreads widen until 02:00 SAST. V25 / Step Index only if you must trade.",
    };
  }
  if (activeSignalSymbol) {
    return {
      headline: `${activeSignalSymbol} • signal ready`,
      regime: "trade",
      tone: "mint",
      detail:
        "Scroll down — a setup just triggered. Tick the safety checks to unlock the MT5 guide.",
    };
  }
  if (status.active.length === 0) {
    const next = status.upcoming[0];
    return {
      headline: next
        ? `Wait — ${next.label} in ${next.startsIn}`
        : "Between sessions",
      regime: "prepare",
      tone: "lavender",
      detail:
        "No forex session is live. Set an alert and step away — no chasing.",
    };
  }
  return {
    headline: "Scanning — no setup yet",
    regime: "prepare",
    tone: "lavender",
    detail: `Watching ${status.recommended.join(", ")}. The card updates the moment a valid entry forms.`,
  };
}