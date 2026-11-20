import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

export type AccountCurrency = "ZAR" | "USD";

export type AccountSettings = {
  balance: number;
  currency: AccountCurrency;
  riskPercent: number;
  exchangeRateZarPerUsd: number;
  maxOpenTrades: number;
  brokerProfile: "deriv_financial" | "deriv_derived" | "other";
};

export const DEFAULT_SETTINGS: AccountSettings = {
  balance: 1000,
  currency: "USD",
  riskPercent: 1,
  exchangeRateZarPerUsd: 18.5,
  maxOpenTrades: 3,
  brokerProfile: "other",
};

export const SETTINGS_COOKIE = "copilot_settings";

function sign(value: string): string {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret) return "";
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function normalizeSettings(value: Partial<AccountSettings>): AccountSettings {
  const balance = Number(value.balance);
  const riskPercent = Number(value.riskPercent);
  const exchangeRate = Number(value.exchangeRateZarPerUsd);
  const maxOpenTrades = Number(value.maxOpenTrades);
  return {
    balance: Number.isFinite(balance) && balance > 0 ? balance : DEFAULT_SETTINGS.balance,
    currency: value.currency === "ZAR" ? "ZAR" : "USD",
    riskPercent: Number.isFinite(riskPercent) && riskPercent > 0 && riskPercent <= 5
      ? riskPercent
      : DEFAULT_SETTINGS.riskPercent,
    exchangeRateZarPerUsd: Number.isFinite(exchangeRate) && exchangeRate > 0
      ? exchangeRate
      : DEFAULT_SETTINGS.exchangeRateZarPerUsd,
    maxOpenTrades: Number.isFinite(maxOpenTrades) && maxOpenTrades >= 1 && maxOpenTrades <= 3
      ? Math.floor(maxOpenTrades)
      : DEFAULT_SETTINGS.maxOpenTrades,
    brokerProfile: value.brokerProfile === "deriv_financial" || value.brokerProfile === "deriv_derived"
      ? value.brokerProfile
      : "other",
  };
}

export function encodeSettings(settings: AccountSettings): string {
  const payload = Buffer.from(JSON.stringify(settings)).toString("base64url");
  const signature = sign(payload);
  return signature ? `${payload}.${signature}` : payload;
}

export function decodeSettings(token: string | undefined): AccountSettings {
  if (!token) return DEFAULT_SETTINGS;
  try {
    const dot = token.indexOf(".");
    if (dot >= 0) {
      const [payload, signature] = [token.slice(0, dot), token.slice(dot + 1)];
      if (!safeEqual(sign(payload), signature)) return DEFAULT_SETTINGS;
      return normalizeSettings(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
    }
    return normalizeSettings(JSON.parse(Buffer.from(token, "base64url").toString("utf8")));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function readSettings(req: NextRequest): AccountSettings {
  return decodeSettings(req.cookies.get(SETTINGS_COOKIE)?.value);
}
