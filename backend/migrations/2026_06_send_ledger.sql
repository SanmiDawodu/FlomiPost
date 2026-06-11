-- =============================================================================
-- send_ledger: idempotency + audit trail for outbound blasts
-- =============================================================================
-- Root cause of the June 2026 spam incident: the queue cron re-processed posts
-- that had no segment target and fanned out to ALL contacts, repeatedly. This
-- table makes a (post, connection, recipient) send happen AT MOST ONCE, and
-- gives you an auditable record of who was messaged and when.
--
-- Apply:  mysql flowpost < 2026_06_send_ledger.sql
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS send_ledger (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    post_id       BIGINT UNSIGNED NOT NULL,
    connection_id BIGINT UNSIGNED NOT NULL,
    channel       VARCHAR(32)     NOT NULL,         -- whatsapp | telegram | ... (SMS scrapped)
    recipient     VARCHAR(255)    NOT NULL,         -- phone / chat id / handle
    site_id       BIGINT UNSIGNED NULL,
    segment_id    BIGINT UNSIGNED NULL,
    status        VARCHAR(16)     NOT NULL DEFAULT 'sent',  -- sent | failed
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    -- The guarantee: the same recipient cannot be messaged twice for the same
    -- post on the same connection. A re-run of the cron becomes a no-op.
    UNIQUE KEY uq_post_conn_recipient (post_id, connection_id, recipient),
    KEY idx_post (post_id),
    KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
