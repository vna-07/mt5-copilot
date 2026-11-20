import type { Instrument } from "./types";

export type EconomicEvent = {
  event: string;
  time: string;
  impact: string;
  country: string;
};

type FinnhubCalendar = {
  economicCalendar?: unknown[];
};

const cache = new Map<string, { at: number; events: EconomicEvent[] }>();
const CACHE_MS = 5 * 60 * 1000;

export function eventsForCurrency(events: EconomicEvent[], inst: Instrument): EconomicEvent[] {
  const symbol = inst.symbol;
  let countries: string[] = [];
  if (symbol.includes("USD")) countries = ["United States", "US"];
  if (symbol === "EURUSD") countries = ["United States", "US", "Euro Area", "EU"];
  if (symbol === "GBPUSD") countries = ["United States", "US", "United Kingdom", "UK", "GB"];
  if (symbol === "USDJPY") countries = ["United States", "US", "Japan", "JP"];
  if (symbol === "GBPJPY") countries = ["United Kingdom", "UK", "GB", "Japan", "JP"];
  if (symbol === "XAUUSD") countries = ["United States", "US"];
  if (symbol === "US100" || symbol === "GER40") countries = ["United States", "US", "Euro Area", "EU"];

  return events.filter((event) => {
    if (inst.category === "crypto" || inst.category === "synthetic") return false;
    return countries.includes(event.country);
  });
}

export function parseFinnhubEvents(payload: unknown): EconomicEvent[] {
  const calendar = payload as FinnhubCalendar;
  if (!Array.isArray(calendar?.economicCalendar)) return [];
  return calendar.economicCalendar
    .map((item) => {
      const event = item as Record<string, unknown>;
      return {
        event: String(event.event ?? "Economic release"),
        time: String(event.time ?? ""),
        impact: String(event.impact ?? "low").toLowerCase(),
        country: String(event.country ?? ""),
      };
    })
    .filter((event) => event.time && (event.impact === "high" || event.impact === "medium"));
}

export async function fetchEconomicEvents(): Promise<EconomicEvent[]> {
  const key = process.env.FINNHUB_API_KEY;
  const customUrl = process.env.ECONOMIC_NEWS_API_URL;
  if (!key && !customUrl) return [];

  const now = new Date();
  const from = now.toISOString().slice(0, 10);
  const to = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const url = customUrl || `https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=${encodeURIComponent(key!)}`;

  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.events;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return hit?.events ?? [];
    const payload = await res.json();
    const events = parseFinnhubEvents(payload);
    cache.set(url, { at: Date.now(), events });
    return events;
  } catch {
    return hit?.events ?? [];
  }
}

export function findNewsBlackout(events: EconomicEvent[], inst: Instrument, now: Date = new Date()) {
  if (inst.category === "crypto" || inst.category === "synthetic") return null;
  const relevant = eventsForCurrency(events, inst).filter((event) => event.impact === "high");
  for (const event of relevant) {
    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(event.time);
    const eventTime = new Date(hasTimezone ? event.time : event.time.replace(" ", "T") + "Z");
    if (!Number.isFinite(eventTime.getTime())) continue;
    const start = eventTime.getTime() - 15 * 60 * 1000;
    const end = eventTime.getTime() + 10 * 60 * 1000;
    if (now.getTime() >= start && now.getTime() <= end) {
      return event;
    }
  }
  return null;
}
