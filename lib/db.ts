import { Pool } from "pg";
import { createHash } from "crypto";

declare global {
  var mt5CopilotPool: Pool | undefined;
}

export function getPool(): Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!global.mt5CopilotPool) {
    global.mt5CopilotPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false },
    });
  }
  return global.mt5CopilotPool;
}

export function accountKey(req: { cookies: { get(name: string): { value: string } | undefined } }): string {
  const token = req.cookies.get("copilot_session")?.value;
  const secret = process.env.APP_SESSION_SECRET || "local-fallback";
  return createHash("sha256").update(`${secret}:${token || "anonymous"}`).digest("hex");
}

export async function ensureSchema(): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(`
    create table if not exists trade_state (
      id text primary key,
      account_key text not null,
      symbol text not null,
      direction text,
      entry double precision not null,
      sl double precision not null,
      tp1 double precision not null,
      tp2 double precision not null,
      tp1_sent boolean not null default false,
      tp2_sent boolean not null default false,
      sl_sent boolean not null default false,
      closed boolean not null default false,
      updated_at timestamptz not null default now()
    );
    create index if not exists trade_state_account_idx on trade_state(account_key);
    create unique index if not exists trade_state_account_symbol_idx on trade_state(account_key,symbol);
    create table if not exists push_subscriptions (
      account_key text primary key,
      subscription jsonb not null,
      updated_at timestamptz not null default now()
    );
    create table if not exists signal_state (
      id text primary key,
      account_key text not null,
      symbol text not null,
      direction text,
      setup text,
      confidence double precision,
      payload jsonb not null,
      created_at timestamptz not null default now()
    );
  `);
}
