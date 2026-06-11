# FlomiPost — Hardening & Improvement Checklist

Findings from a live audit of `scheduler.flomicso.dev` plus the build/handoff
notes. Ordered by stakes. Items 1–3 are the ones that protect real people and
real money.

## What this repo now ships to help
| File | Fixes |
|------|-------|
| `docs/CREDENTIAL-ROTATION.md` | Step-by-step rotation of every exposed secret |
| `deploy/nginx/security-headers.conf` | CSP/HSTS/nosniff/frame/referrer/permissions headers |
| `deploy/nginx/scheduler.flomicso.dev.snippet.conf` | Asset caching + robots + dotfile deny |
| `public/robots.txt` | Real robots file (disallow all — private tool) |
| `backend/core/Safety/RecipientGuard.php` | Fail-closed blast guard + idempotency |
| `backend/migrations/2026_06_send_ledger.sql` | `send_ledger` table for at-most-once sends |
| `deploy/deploy.sh` | Reproducible build + deploy (replaces manual `cp`) |

---

## 1. Rotate exposed secrets (critical)
Live secrets were sitting in plaintext in shared Drive docs. See
`docs/CREDENTIAL-ROTATION.md`. Do this first.

## 2. XSS → account takeover → mass blast (high)
- The session token is stored as `fp_token` in **localStorage**, and the
  `fp_rw_` API keys can message every contact. The site sends **no security
  headers**. A single injected script could exfiltrate the token and blast
  1,700+ real contacts.
- **Apply:** the nginx headers in `deploy/nginx/` (CSP report-only → enforce,
  HSTS, etc.). **Then:** move the session token to an `HttpOnly; Secure;
  SameSite=Strict` cookie, or at minimum keep it behind a strict CSP.

## 3. Publisher must fail closed (high)
- The June 2026 spam incident: a post with no segment target sent to ALL 1,759
  contacts, and the cron re-sent it. The current "LIMIT 100 if no segment"
  rule still sends — just to fewer people — and relies on a human remembering
  to set `segment_id`.
- **Apply:** `RecipientGuard` (no target ⇒ no send) + the `send_ledger` table
  (a cron re-run becomes a no-op). Wire it into every fan-out publisher and
  test on a tiny segment first. Integration steps are in the class docblock.

## 4. Source isn't in version control (high, easy)
- The app lives only on the VPS at `/var/www/flowpost/`. Lose the box, lose the
  app. Deploys are a manual `cp -r dist/* public/` with a "dist path unknown"
  note in the handoff — fragile and unrepeatable.
- **Apply:** commit the real `frontend/` and `backend/` source here (secrets
  stripped — `.env` is git-ignored), pin Vite's `build.outDir`, and use
  `deploy/deploy.sh` (or a GitHub Action) instead of hand-copying.

## 5. Reporting math is wrong (medium)
The June 8 performance report doesn't reconcile, so the dashboard misleads:
- Top cards: **145 published in 30 days** but **47 all-time** (impossible).
- "Success Rate" column is miscalculated — Facebook shows **59 published / 0
  failed = 29%** (should be 100%); WhatsApp **23 / 4 = 18%** (should be ~85%).
  The rate is not `published / (published + failed)`.
- All tracked links show **0 clicks** — click tracking looks broken/unwired.
- **Apply:** fix the success-rate denominator, reconcile the 30-day vs all-time
  counters, and verify the link-click pipeline records hits.

## 6. Connection health surfacing (medium)
X/Twitter (0 sent / 7 failed) and TikTok (0 / 4) are silently failing. A dead
connection currently looks identical to "nothing scheduled." Surface publisher
failures loudly and add retry-with-backoff. Reconnect X per the handoff notes.

## 7. Web hygiene (low — login-gated tool)
- Hashed assets had **no `Cache-Control`** → wasteful 304s on every visit.
  Fixed by `deploy/nginx/scheduler.flomicso.dev.snippet.conf`.
- `robots.txt` / `sitemap.xml` didn't exist (SPA served HTML for them). Real
  `robots.txt` added.
- No `<noscript>` fallback in `index.html` — add a one-line message for the
  JS-disabled / failed-load case. (Requires the frontend source in the repo.)
- SEO/OG tags intentionally skipped — there's nothing public to index.
