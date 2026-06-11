-- =============================================================================
-- webhooks: outbound event notifications for n8n / Zapier / custom integrations
-- =============================================================================
-- WHY: third-party automation tools (n8n, Zapier, Make) need to react to send
-- events (post.sent, post.failed) in real time. Polling the FlomiPost REST API
-- on a timer is wasteful and introduces latency. Outbound webhooks let us push
-- a signed JSON payload to the customer's endpoint the moment an event fires,
-- turning FlomiPost into a first-class event source for no-code pipelines.
--
-- Design notes:
--   outbound_webhooks  — one row per registered endpoint; stores the signing
--                        secret used for HMAC-SHA256 payload verification so
--                        the receiver can confirm the call came from us.
--   webhook_deliveries — append-only log of every delivery attempt; lets the
--                        UI show "last 10 deliveries" and supports one-click
--                        replay on failure without replaying the business logic.
--
-- Apply:  mysql flowpost < 2026_06_webhooks.sql
-- Safe to re-run: both tables use CREATE TABLE IF NOT EXISTS.
-- -----------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- outbound_webhooks: the registered endpoint configuration
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS outbound_webhooks (
    id         BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    site_id    BIGINT UNSIGNED  NOT NULL,
    url        VARCHAR(2048)    NOT NULL,                -- target HTTPS endpoint
    -- secret is stored hashed in application code before insert; raw value
    -- is sent once at creation time and never surfaced again (like GitHub PATs).
    secret     VARCHAR(255)     NULL DEFAULT NULL,       -- HMAC-SHA256 signing key
    -- Comma-separated event filter. The dispatcher checks this before sending
    -- so a webhook registered for 'post.sent' never receives 'post.failed'.
    events     VARCHAR(512)     NOT NULL DEFAULT 'post.sent,post.failed',
    active     TINYINT(1)       NOT NULL DEFAULT 1,      -- 0 = paused by user or after N failures
    created_at TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_site_active (site_id, active)   -- dispatcher query: active hooks for this site

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='One row per registered outbound webhook endpoint per site';

-- ---------------------------------------------------------------------------
-- webhook_deliveries: immutable delivery log (never UPDATE, only INSERT)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id            BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    webhook_id    BIGINT UNSIGNED  NOT NULL,             -- FK → outbound_webhooks.id
    event         VARCHAR(64)      NOT NULL,             -- e.g. 'post.sent'
    -- Full JSON body we POSTed; preserved here so retries send the exact same
    -- payload and the customer's idempotency key stays stable.
    payload       JSON             NOT NULL,
    response_code SMALLINT         NULL DEFAULT NULL,    -- HTTP status from the endpoint; NULL = no response (timeout)
    response_body TEXT             NULL DEFAULT NULL,    -- first 64 KB of the response body
    delivered_at  TIMESTAMP        NULL DEFAULT NULL,    -- NULL until the HTTP call completes
    created_at    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_webhook    (webhook_id),                     -- "show deliveries for this hook"
    KEY idx_created    (created_at)                      -- purge job: DELETE WHERE created_at < cutoff

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Append-only log of every webhook delivery attempt';
