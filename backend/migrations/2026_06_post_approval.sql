-- =============================================================================
-- post_approval: approval workflow columns on the posts table
-- =============================================================================
-- WHY: publishing directly to live audiences without a second pair of eyes has
-- caused mis-sent blasts before (see June 2026 spam incident). This migration
-- adds a lightweight approval gate: a post must transition from 'draft' →
-- 'pending' → 'approved' before the send queue will pick it up. A human
-- reviewer (or an automation acting as one) must set approval_status =
-- 'approved' and record their user-id in approved_by. Rejected posts carry a
-- note explaining why so the author can fix and re-submit.
--
-- Apply:  mysql flowpost < 2026_06_post_approval.sql
-- Safe to re-run: the stored procedure checks information_schema before each
-- ALTER so columns are never added twice.
-- -----------------------------------------------------------------------------

DROP PROCEDURE IF EXISTS _add_post_approval_columns;

DELIMITER $$

CREATE PROCEDURE _add_post_approval_columns()
BEGIN
    -- approval_status: the lifecycle state that the send queue reads.
    -- Only rows with status = 'approved' are eligible for dispatch.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'posts'
          AND COLUMN_NAME  = 'approval_status'
    ) THEN
        ALTER TABLE posts
            ADD COLUMN approval_status ENUM('draft','pending','approved','rejected')
                NOT NULL DEFAULT 'draft'
                COMMENT 'Workflow gate — send queue only dispatches approved rows';
    END IF;

    -- approved_by: FK-able reference to the users table (not enforced here to
    -- avoid cross-migration ordering issues, but indexed for JOIN performance).
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'posts'
          AND COLUMN_NAME  = 'approved_by'
    ) THEN
        ALTER TABLE posts
            ADD COLUMN approved_by BIGINT UNSIGNED NULL DEFAULT NULL
                COMMENT 'users.id of the person who approved or rejected this post';
    END IF;

    -- approved_at: when the status last changed to approved/rejected.
    -- Used by the audit log UI and retention purge jobs.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'posts'
          AND COLUMN_NAME  = 'approved_at'
    ) THEN
        ALTER TABLE posts
            ADD COLUMN approved_at TIMESTAMP NULL DEFAULT NULL
                COMMENT 'Wall-clock time of the last approve/reject decision';
    END IF;

    -- approval_note: free-text reason surfaced back to the post author.
    -- Required by UX when status = 'rejected' so the author knows what to fix.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'posts'
          AND COLUMN_NAME  = 'approval_note'
    ) THEN
        ALTER TABLE posts
            ADD COLUMN approval_note TEXT NULL DEFAULT NULL
                COMMENT 'Reviewer note shown to the post author on rejection';
    END IF;
END$$

DELIMITER ;

CALL _add_post_approval_columns();

DROP PROCEDURE IF EXISTS _add_post_approval_columns;
