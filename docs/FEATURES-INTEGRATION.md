# FlomiPost — Features Integration Guide

This document covers how to wire each new backend feature into publishers, controllers, and the login flow. It assumes you can read the class files; integration steps here are copy-paste ready and show **where** to call things, not how the internals work.

---

## 1. Post Approval Workflow

**Class:** `backend/core/Publishing/ApprovalGate.php`

### Wire into every publisher

Add these two lines at the top of each publisher's send method, **before** any recipient or API work:

```php
require_once __DIR__ . '/../Publishing/ApprovalGate.php';
require_once __DIR__ . '/../Safety/RecipientGuard.php';

$gate  = new ApprovalGate($pdo);
$guard = new RecipientGuard($pdo);

$gate->assertApproved($post);   // throws RuntimeException if not 'approved'
$guard->assertTargeted($post);  // throws if no segment_id or segment is empty
```

Order matters: approval check runs first (cheaper), recipient check second.

### API endpoints to add

| Method | Path | Controller action |
|--------|------|-------------------|
| `POST` | `/api/posts/{id}/request-approval` | `$gate->requestApproval($postId, $userId)` |
| `POST` | `/api/posts/{id}/approve` | `$gate->approve($postId, $approverId)` |
| `POST` | `/api/posts/{id}/reject` | `$gate->reject($postId, $approverId, $reason)` |

Protect `approve` and `reject` with a role check — only users with an `approver` or `admin` role should reach those handlers.

### Post state machine

```
draft → pending (requestApproval) → approved (approve) → [publisher sends]
                                  ↘ rejected (reject)   → operator edits → back to draft
```

All imported posts from BulkImporter start as `draft`. They do not reach the queue until approved.

---

## 2. Bulk CSV Import

**Class:** `backend/core/Scheduling/BulkImporter.php`

### Endpoint

```
POST /api/posts/bulk-import
Content-Type: multipart/form-data
Field: csv  (file upload)
```

### Controller wiring

```php
require_once __DIR__ . '/../../core/Scheduling/BulkImporter.php';

$tmp  = $_FILES['csv']['tmp_name'] ?? '';
if (!is_uploaded_file($tmp)) {
    http_response_code(400);
    echo json_encode(['error' => 'No CSV file uploaded.']);
    exit;
}

$importer = new BulkImporter($pdo);
$result   = $importer->importCsv($tmp, (int) $siteId, (int) $userId);

echo json_encode($result);
// {"imported": 48, "errors": [{"row": 3, "message": "..."}, ...]}
```

### CSV format

```
channel,content,scheduled_at,segment_id
instagram,"Summer sale now live!",2026-07-01 09:00:00,42
facebook,"New arrivals — shop now",2026-07-02T10:30:00+01:00,
whatsapp,"Flash deal: 20% off today only",2026-07-03 12:00:00,7
```

- First row must be a header. Column order is flexible; names are case-insensitive.
- **Required columns:** `channel`, `content`, `scheduled_at`
- **Optional column:** `segment_id` (leave blank to import as NULL; the post will be blocked by RecipientGuard until a segment is assigned before approval)
- `channel` must be one of: `facebook`, `instagram`, `whatsapp`, `telegram`, `linkedin`, `youtube`, `tiktok`, `twitter`
- `scheduled_at` accepts ISO 8601 or `Y-m-d H:i:s`; must be a future timestamp
- Maximum **500 data rows** per file — the importer throws before inserting if exceeded
- Invalid rows are skipped with an error entry; the rest import normally

All imported posts land with `approval_status = 'draft'` and must go through the approval workflow before publishing.

---

## 3. Segment Builder

**Class:** `backend/core/Contacts/SegmentBuilder.php`  
**Migration:** `backend/migrations/2026_06_contact_segments.sql`

### Endpoints

```
POST /api/segments
GET  /api/segments/{id}/count
```

### Create a segment

```php
require_once __DIR__ . '/../../core/Contacts/SegmentBuilder.php';

$builder   = new SegmentBuilder($pdo);
$filters   = json_decode(file_get_contents('php://input'), true)['filters'] ?? [];
$name      = (string) (json_decode(file_get_contents('php://input'), true)['name'] ?? '');
$segmentId = $builder->create((int) $siteId, $name, $filters);

echo json_encode(['segment_id' => $segmentId]);
```

### Count matching contacts

```php
$count = $builder->count((int) $siteId, (int) $segmentId);
echo json_encode(['count' => $count]);
```

### Resolve recipients (internal — publishers only)

```php
$recipients = $builder->resolve((int) $siteId, (int) $segmentId);
// [['recipient' => '+2348012345678', 'channel' => 'whatsapp'], ...]
```

Do not expose `resolve()` as a public API endpoint; the full list is PII-sensitive.

### Filter spec

Each filter is `{"field": "...", "op": "...", "value": "..."}`. All conditions are ANDed.

| `field` | Maps to column | Notes |
|---------|---------------|-------|
| `tag` | `sms_contacts.tags` | Use `contains` op for partial match |
| `city` | `sms_contacts.city` | |
| `country` | `sms_contacts.country` | ISO 3166-1 alpha-2 recommended |
| `created_after` | `sms_contacts.created_at` | Use `gt` op, ISO date value |
| `created_before` | `sms_contacts.created_at` | Use `lt` op |
| `channel` | `sms_contacts.channel` | Allowed values: `whatsapp`, `telegram` |

Allowed `op` values: `eq`, `neq`, `contains`, `gt`, `lt`

Example filter payload:

```json
{
  "name": "Nigerian WhatsApp contacts (2026)",
  "filters": [
    {"field": "country",       "op": "eq", "value": "NG"},
    {"field": "channel",       "op": "eq", "value": "whatsapp"},
    {"field": "created_after", "op": "gt", "value": "2026-01-01"}
  ]
}
```

---

## 4. AI Caption Generation

**Class:** `backend/core/AI/CaptionGenerator.php`

### Prerequisites

Set the API key in your server environment or `.env` loader (never hardcode it):

```
OPENAI_API_KEY=sk-...
```

### Endpoint to wire

```
POST /api/ai/caption
Body: {"topic": "product launch", "channel": "whatsapp", "tone": "friendly"}
```

```php
require_once __DIR__ . '/../../core/AI/CaptionGenerator.php';

$apiKey = getenv('OPENAI_API_KEY');
if (!$apiKey) {
    http_response_code(503);
    echo json_encode(['error' => 'AI captions are not configured on this server.']);
    exit;
}

$body    = json_decode(file_get_contents('php://input'), true);
$gen     = new CaptionGenerator($apiKey);
$caption = $gen->generate(
    (string) ($body['topic']   ?? ''),
    (string) ($body['channel'] ?? 'instagram'),
    (string) ($body['tone']    ?? 'professional')
);

echo json_encode(['caption' => $caption]);
```

**Never** auto-populate `posts.content` from the AI response without a human review step. Always return the generated text to the operator for editing first.

---

## 5. Outbound Webhooks

**Class:** `backend/core/Webhooks/WebhookDispatcher.php`  
**Migration:** `backend/migrations/2026_06_webhooks.sql`

### Wire into publishers

Call `dispatch()` **after** the channel API call resolves (success or failure), outside any open DB transaction:

```php
require_once __DIR__ . '/../Webhooks/WebhookDispatcher.php';

$dispatcher = new WebhookDispatcher($pdo);

if ($sendSuccess) {
    $dispatcher->dispatch($post['site_id'], 'post.sent', [
        'post_id'    => $post['id'],
        'channel'    => 'whatsapp',
        'recipient'  => $recipientPhone,
        'sent_at'    => date('c'),
    ]);
} else {
    $dispatcher->dispatch($post['site_id'], 'post.failed', [
        'post_id'  => $post['id'],
        'channel'  => 'whatsapp',
        'error'    => $apiErrorMessage,
        'failed_at'=> date('c'),
    ]);
}
```

### Wire into ApprovalGate state changes

In your approval/rejection controller actions:

```php
// After $gate->approve(...)
$dispatcher->dispatch($siteId, 'post.approved', ['post_id' => $postId]);

// After $gate->reject(...)
$dispatcher->dispatch($siteId, 'post.rejected', ['post_id' => $postId, 'reason' => $reason]);
```

### Standard event names

`post.sent` | `post.failed` | `post.approved` | `post.rejected`

Dispatch calls are synchronous with a 5-second timeout per endpoint. Do not call inside a short-lived DB transaction.

---

## 6. TOTP / MFA

**Class:** `backend/core/Auth/TOTPAuthenticator.php`  
**Migration:** `backend/migrations/2026_06_totp_auth.sql`

### Enrolment flow (one-time, on the 2FA settings page)

```php
require_once __DIR__ . '/../../core/Auth/TOTPAuthenticator.php';

$totp   = new TOTPAuthenticator();
$secret = $totp->generateSecret();

// Store encrypted in users.totp_secret (AES-256-CBC or similar).
// Do NOT store in plaintext.
saveEncryptedTotpSecret($userId, $secret);

// Return the provisioning URI; the frontend renders it as a QR code.
$uri = $totp->getProvisioningUri($secret, $user['email']);
echo json_encode(['uri' => $uri]);   // GET /api/auth/totp/setup
```

Generate and show backup codes at enrolment. Store them hashed (bcrypt/argon2), not plaintext:

```php
$codes = $totp->generateBackupCodes();  // returns array of 8 strings
// hash each with password_hash() before storing; show plaintext once to user
```

### Login flow changes

After password verification, add:

```php
if ((int) ($user['totp_enabled'] ?? 0) === 1) {
    $code   = (string) ($_POST['totp_code'] ?? '');
    $secret = decryptTotpSecret($user['totp_secret']);  // your decryption wrapper

    if (!$totp->verify($secret, $code)) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid or expired TOTP code.']);
        exit;
    }
}
// Proceed to session creation only after this block.
```

### QR code endpoint

```
GET /api/auth/totp/setup
```

Returns `{"uri": "otpauth://totp/..."}`. The frontend passes this to a JS QR library (e.g. `qrcode.js`). The URI must not be logged.

### Notes

- `$window=1` in `verify()` tolerates ±30 s clock skew. Raise to `2` only if users report consistent failures.
- Backup codes must be consumed (deleted/marked used) after a single successful login.

---

## 7. Channel Health Dashboard

**Class:** `backend/core/Health/ChannelHealthTracker.php`  
**Migration:** `backend/migrations/2026_06_channel_health.sql`

### Wire into publishers

Immediately after each channel API call:

```php
require_once __DIR__ . '/../Health/ChannelHealthTracker.php';

$health = new ChannelHealthTracker($pdo);

if ($apiSuccess) {
    $health->recordSuccess($post['site_id'], $connectionId, 'whatsapp');
} else {
    $health->recordFailure($post['site_id'], $connectionId, 'whatsapp', $apiErrorMessage);
}
```

### Endpoint

```
GET /api/health/channels?site_id={id}
```

```php
$health = new ChannelHealthTracker($pdo);
$data   = $health->getDashboard((int) ($_GET['site_id'] ?? 0));
echo json_encode($data);
```

Response shape: array of connections with `channel`, `status` (`ok`|`error`), `last_error`, and `checked_at`. Suitable for rendering a status table in the admin UI.

---

## 8. Migration Apply Order

Apply in this sequence. Each migration is safe to re-run (`IF NOT EXISTS` and `IF NOT EXISTS` guards throughout):

1. `2026_06_send_ledger.sql` — idempotency table for RecipientGuard
2. `2026_06_post_approval.sql` — adds `approval_status` column to posts
3. `2026_06_contact_segments.sql` — contact_segments table for SegmentBuilder
4. `2026_06_webhooks.sql` — webhooks table for WebhookDispatcher
5. `2026_06_totp_auth.sql` — adds totp_secret / totp_enabled to users
6. `2026_06_channel_health.sql` — channel_health_log table
7. `2026_06_post_templates.sql` — post_templates table (independent, apply last)

```bash
# Example — run from repo root
for f in \
  2026_06_send_ledger \
  2026_06_post_approval \
  2026_06_contact_segments \
  2026_06_webhooks \
  2026_06_totp_auth \
  2026_06_channel_health \
  2026_06_post_templates; do
    mysql flomipost < backend/migrations/${f}.sql && echo "OK: ${f}" || echo "FAIL: ${f}"
done
```

Run on a staging DB first. Verify `SHOW TABLES` and a quick smoke-test publish before applying to production.
