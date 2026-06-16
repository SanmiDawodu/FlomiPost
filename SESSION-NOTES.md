# FlomiPost — Session Notes (2026-06-16)

Handoff record of a working session on the FlomiPost scheduler
(`scheduler.flomicso.dev`). Saved because the working environment is
ephemeral.

## Original request
> "FlomiPost mobile and tablet composer not responsive."

## TL;DR
- The composer responsiveness bug is **fixed and deployed live** (frontend-only
  rebuild on the VPS).
- Along the way we discovered the repo's committed source had **drifted behind
  production**, and the existing deploy workflow was **dangerous**. Both are
  addressed via two open PRs.
- One item is **parked pending a decision**: capturing the backend into git
  (the repo is public and the backend likely holds live secrets).

## What we found
1. The live app was **not built from the source committed in this repo** — the
   running UI had a top notification bar, a "New Post" button, and different nav
   (Compose / All Posts / Help & Guides) that didn't exist in the committed
   `frontend/`. Confirmed the live `frontend/` source lived only on the VPS
   (matches `docs/SECURITY-HARDENING.md` item #4).
2. The app shell is **already responsive** (sidebar collapses to a drawer
   below 768px). The breakage was in the composer page itself.
3. The existing `deploy.yml` was a **landmine**: on every push to `main` it
   `git reset --hard`'d the whole `/var/www/flowpost` repo to a stale branch and
   auto-ran DB migrations — which could revert the live frontend, reset the
   backend to stale code, and migrate unattended.

## What we did
- **Captured the live `frontend/` source** into the branch via a read-only
  GitHub Action (tar over SSH using the existing deploy key).
- **Fixed the composer** (`frontend/src/pages/ComposePage.jsx`):
  - Top bar now wraps; the site/campaign/set/segment selects flex instead of
    fixed widths; the channel row gets `min-width:0` so it shrinks/scrolls
    instead of pushing the Draft/Post buttons off-screen.
  - Below 768px the composer flows and the page scrolls (was a fixed
    `height:calc(100vh-60px)` + `overflow:hidden` that clipped the bottom
    controls).
  - Added a mobile-only **Edit/Preview** toggle (the preview pane was hidden on
    mobile with no way to reach it).
  - Desktop (>900px) unchanged. Verified with a production `vite build`.
- **Deployed it** frontend-only (rsync `frontend/src` + rebuild in place on the
  VPS). Build succeeded; fix is **live**.
- **Made `deploy.yml` safe**: replaced the destructive reset/migrate-on-push
  with a manual, frontend-only deploy (workflow_dispatch + `ref` input) that
  never touches the backend, server git state, node_modules, or the DB.
- Removed the one-off helper workflows once their job was done.

## Open PRs (watching both)
- **PR #3 → `main`** — "Fix deploy.yml: stop the destructive reset." Small,
  defuses the landmine. **Merge this first.**
  https://github.com/SanmiDawodu/FlomiPost/pull/3
- **PR #2 → `claude/affectionate-dijkstra-ked6ul`** — "Make the composer
  responsive + capture live frontend source." The substantive change.
  https://github.com/SanmiDawodu/FlomiPost/pull/2

CI at last check: PR #2 lint passed; PR #3 had no blocking checks; no review
comments on either.

## Recommended next steps
1. Merge **PR #3** (defuse the deploy landmine). Stopgap if not merging now:
   disable the `deploy` workflow in the Actions tab. The safe deploy's
   "Run workflow" button appears in the UI only after this merges to `main`.
2. Merge **PR #2** after review.
3. **PARKED — backend source not in git.** Same risk class the frontend just
   had, but higher stakes: **this repo is public** (`"private": false`) while
   the README calls FlomiPost a "private tool," and secrets have been exposed
   before (`docs/CREDENTIAL-ROTATION.md`). Committing the backend could publish
   live credentials. Decision needed before capture:
   - (recommended) make the repo **private** first, then capture; or
   - run a **read-only secret scan** of the backend and review before committing; or
   - capture now with `.gitignore` + config excludes (not recommended while public).

## Environment notes
- Live source of truth: VPS at `/var/www/flowpost/` (frontend + backend).
- Deploys: now a manual, frontend-only GitHub Action (post-PR-#3).
- `send_later` was not available this session, so periodic self check-ins on the
  PRs couldn't be auto-scheduled; events (CI failures, review comments) are
  still delivered to the watching session.

## Branch map
- `claude/magical-hawking-sn2uta` — working branch (composer fix + captured live
  frontend + safe deploy.yml). Head of PR #2.
- `fix/safe-deploy-workflow` — deploy.yml hotfix off `main`. Head of PR #3.
- `claude/affectionate-dijkstra-ked6ul` — the branch the live app deploys from.
