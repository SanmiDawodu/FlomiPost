-- =============================================================================
-- contact_segments: stores filter rules for dynamic contact segments
-- =============================================================================
-- WHY: hard-coding contact lists inside posts doesn't scale and makes
-- retargeting campaigns impossible. A segment is a named set of filter rules
-- (stored as JSON) that SegmentBuilder resolves at send time against
-- sms_contacts. Because resolution is live, contacts added after the segment
-- was created are automatically included in subsequent sends.
--
-- RecipientGuard::assertTargeted() requires every post to have a segment_id
-- that resolves to at least one recipient. This table backs that requirement.
--
-- Apply:  mysql flowpost < 2026_06_contact_segments.sql
-- Safe to re-run: uses CREATE TABLE IF NOT EXISTS and IF NOT EXISTS guards on
-- the ALTER statement.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS contact_segments (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    site_id    BIGINT UNSIGNED NOT NULL
                   COMMENT 'Owning site — segments are not shared across sites',
    name       VARCHAR(255)    NOT NULL
                   COMMENT 'Human-readable label shown in the scheduler UI',
    filters    JSON            NOT NULL
                   COMMENT 'Array of {field, op, value} objects; see SegmentBuilder',
    created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_site (site_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Dynamic contact-segment filter rules — see SegmentBuilder.php';

-- -----------------------------------------------------------------------------
-- posts.segment_id reference note
-- -----------------------------------------------------------------------------
-- The posts table already has a segment_id BIGINT UNSIGNED NULL column (added
-- as part of the original schema). Now that contact_segments exists, posts rows
-- with a segment_id value reference contact_segments.id for the same site.
--
-- A hard FOREIGN KEY constraint is intentionally NOT added here because:
--   1. Existing posts rows that pre-date this migration carry NULLs, which is fine.
--   2. Some posts may reference segments that are deleted after scheduling; a FK
--      would block the delete and orphan the post in the send queue.
--   3. RecipientGuard already hard-fails at dispatch time if the segment has no
--      recipients, which is the safety property we actually need.
--
-- If you want referential integrity enforced at the DB level in future, add:
--   ALTER TABLE posts
--       ADD CONSTRAINT fk_posts_segment_id
--       FOREIGN KEY (segment_id) REFERENCES contact_segments(id)
--       ON DELETE SET NULL;
-- … after confirming there are no orphaned segment_id values in posts.
-- -----------------------------------------------------------------------------
