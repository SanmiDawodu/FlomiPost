# FlomiPost

Multi-channel social/messaging scheduler — **scheduler.flomicso.dev**. Schedules
and publishes posts across Facebook, Instagram, WhatsApp, Telegram, LinkedIn,
YouTube, TikTok, X/Twitter, and SMS, with contact segmentation, analytics, and
link tracking.

> The application source currently lives on the VPS at `/var/www/flowpost/` and
> is **not yet in this repo** — getting it here is a tracked improvement (see
> `docs/SECURITY-HARDENING.md`, item 4). This repo currently holds the hardening
> and operations package below.

## Architecture (from build notes)
- **Host:** Hetzner VPS, Ubuntu 24.04, nginx + PHP 8.2/8.3 + MariaDB (`flowpost`).
- **Frontend:** React + Vite SPA, served from `/var/www/flowpost/public`.
- **Backend:** PHP front controller at `/var/www/flowpost/backend/index.php`,
  API under `/api/*` (token-auth, `fp_token` bearer; `fp_rw_`/`fp_ro_` dev keys).
- **Publishers:** `/var/www/flowpost/backend/core/Publishers/*` driven by a
  queue cron (`process_queue.php`).

## This repo: hardening & ops package
Start here: **`docs/SECURITY-HARDENING.md`** (prioritized checklist) and
**`docs/CREDENTIAL-ROTATION.md`** (do this first — live secrets were exposed).

| Path | Purpose |
|------|---------|
| `docs/CREDENTIAL-ROTATION.md` | Rotate every exposed secret, provider by provider |
| `docs/SECURITY-HARDENING.md` | Full prioritized findings + fixes |
| `deploy/nginx/security-headers.conf` | Security headers include for nginx |
| `deploy/nginx/scheduler.flomicso.dev.snippet.conf` | Caching + robots + dotfile deny additions |
| `public/robots.txt` | Real robots.txt (disallow all — private tool) |
| `backend/core/Safety/RecipientGuard.php` | Fail-closed blast guard (prevents the spam-incident class of bug) |
| `backend/migrations/2026_06_send_ledger.sql` | `send_ledger` table for at-most-once sends |
| `deploy/deploy.sh` | Reproducible build + deploy |

## Apply order
1. **Rotate secrets** — `docs/CREDENTIAL-ROTATION.md`.
2. **Stop runaway blasts** — run `backend/migrations/2026_06_send_ledger.sql`,
   wire `RecipientGuard` into the publishers, test on a tiny segment.
3. **Harden the edge** — install the nginx snippets, `nginx -t && reload`.
4. **Back up the app** — commit `frontend/` + `backend/` here (secrets stripped).
