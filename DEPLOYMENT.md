# Deployment Guide

## Prerequisites

- Docker + Docker Compose v2
- A domain/host with ports 80 (client) and 5001 (server API) reachable, or a reverse proxy in front of them

## 1. Configure environment

The server reads its config from `server/.env` at container start (via
`env_file` in `docker-compose.yml`). This file is **never committed** —
create it from the template:

```bash
cp server/.env.example server/.env
```

Then fill in at minimum:

| Variable | Required | Notes |
|---|---|---|
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Yes | Long, random strings — e.g. `openssl rand -hex 32` |
| `JWT_ACCESS_EXPIRE` / `JWT_REFRESH_EXPIRE` | Yes | e.g. `15m` / `7d` |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | For email features | Use an app password, not your main account password |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | For payments | From the Razorpay dashboard |
| `TWILIO_*` | For SMS/WhatsApp reminders | From the Twilio console |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | For Google Sign-In | Must also be set as `VITE_GOOGLE_CLIENT_ID` in `client/.env` at **build** time |

If `server/.env` is missing or missing a required key, `docker compose up`
will fail fast with a clear error (either "env file not found" or the
app's own `[Config] Missing required environment variables` message) —
it will not silently crash-loop.

## 2. Build and start

```bash
docker compose up -d --build
```

This builds two images:
- **server** — plain Node 20-alpine, runs `node server.js`, exposes `5001`
- **client** — Vite build served by nginx, exposes `80`, proxies `/api/` and `/uploads/` to the server container

Data persists in two named volumes:
- `billing_data` → SQLite database file (`/usr/src/app/database/billing.db`)
- `billing_uploads` → uploaded files (logos, attachments)

## 3. Database migrations

Migrations run automatically on server boot (`server.js` requires and
invokes each `migrations/00N_*.js` file in order on startup). No manual
migration step is needed for a fresh deploy or an upgrade — just restart
the server container after pulling new code.

## 4. Verify

```bash
docker compose ps                 # both services should show "healthy"
curl http://localhost:5001/health # {"status":"ok",...}
curl http://localhost/            # client should serve the SPA
```

## 5. Backups

The SQLite database is a single file inside the `billing_data` volume.
To back it up:

```bash
docker run --rm -v saas-billing-milestone4-complete_billing_data:/data \
  -v "$(pwd)":/backup alpine \
  cp /data/billing.db /backup/billing-backup-$(date +%Y%m%d).db
```

Take this backup before any deploy that includes a new migration.

## 6. Updating

```bash
git pull
docker compose up -d --build
```

The server container re-runs migrations automatically on start; only
new/changed migrations actually do anything (each is idempotent).

## Notes

- The compose file forces `NODE_ENV=production`, `PORT=5001`, and
  `FRONTEND_URL` regardless of what's in `.env` — those are tied to the
  container's own network context and shouldn't be overridden per-environment
  via `.env`.
- For a real production domain, put a TLS-terminating reverse proxy
  (e.g. Caddy, Traefik, or a managed load balancer) in front of the
  `client` container rather than exposing port 80 directly.
