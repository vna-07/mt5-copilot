# MT5 Co-Pilot

## Local environment variables

Copy `.env.example` to `.env.local`, then configure the values below. Never commit `.env.local` or post secret values in chat.

- `TWELVEDATA_API_KEY`: Twelve Data API key for candles.
- `DERIV_APP_ID`: Public Deriv application ID for the synthetic-index WebSocket adapter.
- `DERIV_API_TOKEN`: Optional private Deriv authorization token. Public candle data may not require this; keep it server-only.
- `APP_ACCESS_CODE`: Four-digit private app login code.
- `APP_SESSION_SECRET`: Long random server secret used for sessions and signed settings.
- `VAPID_PUBLIC_KEY`: Web Push public key.
- `VAPID_PRIVATE_KEY`: Web Push private key.
- `VAPID_SUBJECT`: Contact URL or `mailto:` address for Web Push.
- `ECONOMIC_NEWS_API_URL`: Optional JSON endpoint providing economic releases.
- `FINNHUB_API_KEY`: Optional Finnhub API key. The status endpoint builds the 7-day economic-calendar URL automatically.

The trade watcher endpoint (`/api/trades/watcher`) is protected by `CRON_SECRET`. Vercel Hobby only
supports daily cron schedules, so call this endpoint from an external scheduler every 1–5 minutes
using either `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret: <CRON_SECRET>`.

Generate VAPID keys:

```powershell
npx.cmd web-push generate-vapid-keys
```

Generate a session secret:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```