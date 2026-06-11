# Credential Rotation Runbook

**Why now:** live production secrets were found sitting in plaintext inside
shared Google Drive session-handoff documents (and duplicated across several of
them). Treat every secret below as compromised and rotate it. None of the
actual values are reproduced here on purpose — this file is safe to commit.

After rotating, the new values go **only** in the server `.env`
(`/var/www/flowpost/.env`) or the app's settings table — never in a Drive doc,
chat message, or this repo. `.env` is git-ignored (see `.gitignore`).

Work top-to-bottom; the first three are the highest impact.

---

## 1. FlomiPost admin login
- **Problem:** password is a weak, guessable pattern and was written in handoff docs.
- **Do:** change the password for `support@sanmidawodu.org` in FlomiPost to a long random passphrase. Enable MFA if the app supports it; if it doesn't, that's a worthwhile feature to add.

## 2. FlomiPost developer API keys (`fp_rw_…`, `fp_ro_…`)
- **Problem:** the read-write key grants full write access — including the ability to message every contact — and was shared in docs.
- **Do:** revoke the existing `fp_rw_…` and `fp_ro_…` keys in the FlomiPost API/Integrations page and generate new ones. Update any caller (n8n workflows, scripts, Zapier/Make scenarios) with the new key. Confirm old keys return 401 afterward.

## 3. Twilio (SMS + Voice) — ACCOUNT WAS COMPROMISED; SMS IS BEING SCRAPPED
- **What happened:** the `TWILIO_AUTH_TOKEN` leaked (in `.env` and Drive docs)
  and was used for SMS-pumping fraud (~$255.79 unauthorized usage). Twilio
  suspended the account ~June 10, 2026, which already killed the leaked token
  and API key (both return 401). See the Drive "Twilio Fraud Incident" doc.
- **Keys in `.env`:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY`, `TWILIO_API_SECRET`, `TWILIO_TWIML_APP_SID`, `TWILIO_FROM_NUMBER`.
- **Decision:** SMS is being scrapped. So the goal is **remove and revoke**, not rotate-and-keep:
  1. Remove every Twilio line from the server env: `sed -i '/TWILIO_/d' /var/www/flowpost/.env` then reload PHP-FPM.
  2. Delete the plaintext Twilio values from the Drive docs (June 7 "Build Session" and "Session Final"); the secret values are not reproduced here.
  3. In the Twilio Console, once the suspension is resolved, **close the account** (or at minimum rotate the Auth Token and delete the old API key so the leaked values are permanently dead) and pursue the fraud billing credit.
- **Note:** the leaked values are almost certainly already dead from the
  suspension — but treat them as compromised and revoke at the source anyway.

## 4. Twitter / X
- **Keys in `.env`:** `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET`.
- **Do:** in the X Developer Portal, regenerate the **client secret** for the app. The OAuth callback (`https://scheduler.flomicso.dev/api/oauth/twitter/callback`) stays the same. Update `.env`, then re-run the connect flow for the affected connection.

## 5. Google OAuth (GA / Analytics integration)
- **Project:** `flomipost-analytics`; redirect `https://scheduler.flomicso.dev/api/ga/callback`. Stored as `GA_CLIENT_SECRET` (the `GOCSPX-…` value).
- **Do:** in Google Cloud Console > APIs & Services > Credentials, **reset the client secret** for the OAuth client. Update `.env`. Re-authorize the GA connection in the app.

## 6. OpenAI
- **Where:** stored in the FlomiPost settings DB (`sk-proj-…`).
- **Do:** in the OpenAI dashboard, revoke the leaked key and create a new one. Update the value in the app's settings.

## 7. Third-party API keys
Rotate each in its provider dashboard, then update `.env` / settings:
- **Adzuna** — App ID + Key (flomicso.net job board)
- **Google Places** — API key (flomicso.info directory); also add HTTP-referrer / API restrictions in Google Cloud so a leaked key can't be abused from elsewhere
- **JSearch (RapidAPI)** — regenerate the RapidAPI key
- **Google AdSense** — publisher ID is not secret, no action

## 8. Other secrets found exposed in Drive docs (rotate these too)
The May 31 hand-off and related docs leaked more than the items above. Treat
all as compromised:
- **ElevenLabs** — `ELEVENLABS_API_KEY` (`sk_…`); revoke + reissue.
- **FlomiPost production API token** — the long `be6dc4a2…` token; revoke + reissue.
- **SSH access** — an SSH key for `claude@…` was recorded; remove it from the
  VPS `~/.ssh/authorized_keys` if it should no longer have access.
- **VPS root password** — flagged as exposed in the fraud-incident doc; change it.
- **Meta / LinkedIn / Canva / Reddit / TikTok / YouTube / Gemini / Runway** —
  OAuth client secrets and API keys listed in the hand-off; rotate any that are
  still in use.

---

## After rotating everything
1. `grep -rIn "GOCSPX\|sk-proj\|AC[0-9a-f]\{30\}\|fp_rw_\|fp_ro_" /var/www/flowpost` to confirm no secrets are hard-coded in source (they should only be in `.env`).
2. Delete or lock down the Drive handoff docs that contain the old secrets, or scrub the secret sections.
3. Restart the backend / reload PHP-FPM so the new `.env` is picked up.
4. Smoke-test one send per channel on a tiny test segment before any real blast.
