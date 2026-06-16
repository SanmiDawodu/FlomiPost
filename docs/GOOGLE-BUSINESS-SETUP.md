# Google Business Profile — Connect & Publish

Adds **Google Business Profile** (formerly *Google My Business*) as a publishing
channel: scheduled posts fan out to a Business Profile location as a Google Post
(visible on Google Search and Maps). It plugs into the existing publisher /
OAuth machinery exactly like the YouTube and GA Google integrations.

`google_business` already exists as a platform in the live DB — today it only
offers **Connect manually**. This change adds the proper **OAuth connect flow**
plus the **publisher** that actually posts.

> ⚠️ **Revoke the OAuth Playground token.** The refresh/access tokens generated
> in the Google OAuth Playground during testing were shared in a screenshot.
> Treat them as compromised: revoke that grant at
> <https://myaccount.google.com/permissions> and rely on the dedicated client
> below instead. Never paste live tokens into chats, screenshots, or docs — same
> rule as `docs/CREDENTIAL-ROTATION.md`.

---

## What ships in this change (in the repo)
| Path | Purpose |
|------|---------|
| `backend/core/GoogleBusinessOAuth.php` | OAuth2 + account/location discovery helper |
| `backend/core/Publishers/GoogleBusinessPublisher.php` | Posts to `v4/.../localPosts`, auto-refreshes the token |
| `backend/index.php` | `/oauth/google_business/start` + `/callback` routes (and the two `require_once`s) |
| `backend/cron/process_queue.php` | `require_once`s the new publisher so the cron can dispatch it |
| `backend/migrations/2026_06_google_business_oauth.sql` | Idempotent platform seed (no-op in prod) |
| `frontend/src/pages/ConnectionsPage.jsx` | "Connect Google Business" button (repo frontend only — see step 5) |

---

## 1. Create a dedicated Google Cloud OAuth client
You chose a **separate** OAuth client (not the `flomipost-analytics` one).

1. Google Cloud Console → create/pick a project (e.g. `flomipost-gbp`).
2. **APIs & Services → Library**, enable:
   - *Google My Business API* (a.k.a. **My Business Account Management API**)
   - *My Business Business Information API*
   - *Business Profile API* / *My Business* (the v4 endpoint used for posts)
3. **OAuth consent screen**: external, add the scope
   `https://www.googleapis.com/auth/business.manage`, and add
   `support@sanmidawodu.org` as a test user (until the app is verified).
4. **Credentials → Create credentials → OAuth client ID → Web application**.
   - Authorized redirect URI:
     `https://scheduler.flomicso.dev/api/oauth/google_business/callback`
   - Note the **Client ID** and **Client secret**.

## 2. Request Business Profile API access (quota)
The Business Profile APIs ship with **0 default quota**. Submit the access
request form (Cloud Console → the API → *Quotas*, or the Business Profile API
access request form) from the same project. Posting will 403 until approved.

## 3. Environment variables
Add to `/var/www/flowpost/.env` (git-ignored — never commit these):

```
GOOGLE_BUSINESS_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_BUSINESS_CLIENT_SECRET=GOCSPX-xxxxxxxx
# Optional — only if the callback host ever differs from the default:
# GOOGLE_BUSINESS_REDIRECT_URI=https://scheduler.flomicso.dev/api/oauth/google_business/callback
```
Then reload PHP-FPM so the new env is picked up.

## 4. Register the publisher in the factory  *(manual — server-only file)*
`backend/core/PublisherFactory.php` is **not** in version control (it lives only
on the VPS, like the other framework files), so it can't be edited via this repo.
Add `google_business` to its key → class map. With the require already wired in
`process_queue.php` and `index.php`, it's a one-liner, e.g.:

```php
'google_business' => GoogleBusinessPublisher::class,
```
(match the exact array/switch style already used in that file). If the factory
resolves class names by convention — `google_business` → `GoogleBusinessPublisher`
— it already works and no edit is needed. Verify with a test publish (step 7).

## 5. Frontend "Connect with OAuth" button  *(live frontend is not in the repo)*
The live **Platform Connections** page is richer than the committed
`ConnectionsPage.jsx` and is **not** in this repo (see `SECURITY-HARDENING.md`
item 4). Deploying this repo's frontend as-is would *regress* that page — don't.

In the **live** frontend source on the VPS, make the Google Business card use
OAuth instead of "Connect manually": add `google_business` to the same list that
gives pinterest/reddit their **Connect with OAuth** button, pointing the click at:

```
/api/oauth/google_business/start?site_id=<selected site id>
```
(Committing the real frontend here, per hardening item 4, removes this drift.)

## 6. Migrations
The deploy runs `backend/migrations/*.sql`. `2026_06_google_business_oauth.sql`
is a no-op in prod (the platform row already exists); it only helps fresh
installs.

## 7. Connect & test
1. Reload PHP-FPM, deploy the backend.
2. Open **Connections**, click **Connect Google Business**, complete Google
   consent. The callback creates **one connection per Business Profile location**
   (`account_id` = `accounts/{id}/locations/{id}`), storing the access + refresh
   tokens encrypted.
3. Compose a tiny post targeting the new Google Business connection, schedule it
   a minute out, and confirm it appears on the profile. A scheduled post fires
   after the ~1h access-token lifetime — the publisher refreshes from the stored
   refresh token automatically.

## Notes / limits
- Google Posts take **one photo** (no carousel/video) and up to **1500 chars**;
  the publisher truncates and sends the first image only.
- A post `link_url` becomes a **Learn more** call-to-action button.
- v1 Business Profile APIs never absorbed `localPosts`; the still-active **v4**
  endpoint `https://mybusiness.googleapis.com/v4/{parent}/localPosts` is used.
