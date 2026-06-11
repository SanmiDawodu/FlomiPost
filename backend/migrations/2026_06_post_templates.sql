-- =============================================================================
-- post_templates: reusable content blueprints for recurring post types
-- =============================================================================
-- WHY: site operators often send the same structural message repeatedly (weekly
-- newsletters, promotional blasts, appointment reminders). Without templates
-- they copy-paste previous posts, which means each copy drifts in formatting
-- and every edit touches live data. This table stores authorable, per-site
-- templates keyed by channel so the composer UI can pre-populate content and
-- media without touching a real post row until the author is ready to publish.
--
-- Apply:  mysql flowpost < 2026_06_post_templates.sql
-- Safe to re-run: CREATE TABLE IF NOT EXISTS is idempotent.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS post_templates (
    id          BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    site_id     BIGINT UNSIGNED  NOT NULL,               -- tenant owning this template
    name        VARCHAR(255)     NOT NULL,               -- human label shown in the picker UI
    channel     VARCHAR(32)      NOT NULL,               -- whatsapp | telegram | email | ...
    content     TEXT             NOT NULL,               -- body text; may include {{merge_tags}}
    -- media_urls stores an ordered JSON array of attachment URLs so templates
    -- can carry images/videos without a separate join table. NULL = text-only.
    media_urls  JSON             NULL DEFAULT NULL,
    created_by  BIGINT UNSIGNED  NULL DEFAULT NULL,      -- users.id; NULL for system-seeded rows
    created_at  TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    -- Composite index covers the most common query pattern: "give me all
    -- templates for this site on this channel" (the channel picker dropdown).
    KEY idx_site_channel (site_id, channel)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Reusable post blueprints; one row per named template per site';
