-- =============================================================================
-- channel_health_log: per-connection health state for the dashboard
-- =============================================================================
-- WHY: operators need a live view of which channels are working and which have
-- broken credentials or API limits before they try to schedule a blast. Instead
-- of computing health by scanning send_ledger (expensive, lags behind reality),
-- the publisher worker upserts one row per connection after every publish
-- attempt. The dashboard then does a single O(connections) scan of this table
-- rather than an aggregation over millions of ledger rows.
--
-- Upsert pattern (document):
--   INSERT INTO channel_health_log
--       (site_id, connection_id, channel, status, last_error, checked_at)
--   VALUES (?, ?, ?, ?, ?, NOW())
--   ON DUPLICATE KEY UPDATE
--       channel    = VALUES(channel),
--       status     = VALUES(status),
--       last_error = VALUES(last_error),
--       checked_at = VALUES(checked_at);
--
--   The UNIQUE KEY on (site_id, connection_id) makes INSERT ... ON DUPLICATE
--   KEY UPDATE behave as an upsert: first attempt inserts, every subsequent
--   attempt updates the existing row in place. Result: exactly one row per
--   connection at all times, always reflecting the most recent check.
--
-- Apply:  mysql flowpost < 2026_06_channel_health.sql
-- Safe to re-run: CREATE TABLE IF NOT EXISTS is idempotent.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS channel_health_log (
    id            BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    site_id       BIGINT UNSIGNED  NOT NULL,
    connection_id BIGINT UNSIGNED  NOT NULL,
    channel       VARCHAR(32)      NOT NULL,             -- whatsapp | telegram | email | ...
    status        ENUM('ok','degraded','error') NOT NULL,
    -- last_error stores the raw API error message or exception class so support
    -- can diagnose without asking the operator to reproduce the failure.
    last_error    TEXT             NULL DEFAULT NULL,    -- NULL when status = 'ok'
    checked_at    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    -- One row per connection. The upsert pattern described above relies on
    -- this key to turn INSERT into UPDATE for existing connections.
    UNIQUE KEY uq_site_connection (site_id, connection_id),

    -- Dashboard query: "show me all degraded/error connections for this site"
    KEY idx_site_status (site_id, status)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='One row per connection, upserted on every publish attempt; powers health dashboard';
