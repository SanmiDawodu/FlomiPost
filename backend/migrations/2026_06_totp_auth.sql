-- =============================================================================
-- totp_auth: time-based one-time password (MFA) columns on the users table
-- =============================================================================
-- WHY: a credential-stuffing attack in Q2 2026 compromised several admin
-- accounts that had weak or reused passwords. TOTP (RFC 6238) as a second
-- factor stops these attacks even when the password is known — the attacker
-- also needs physical access to the authenticator app. totp_enabled acts as
-- the feature flag so we can roll out MFA progressively (opt-in first,
-- mandatory for admin roles later) without a second migration.
--
-- totp_backup_codes stores a JSON array of one-time recovery codes so users
-- can regain access if they lose their authenticator device. Codes must be
-- hashed by application code before insert (bcrypt / argon2); never store raw.
--
-- Apply:  mysql flowpost < 2026_06_totp_auth.sql
-- Safe to re-run: the stored procedure checks information_schema before each
-- ALTER so columns are never added twice.
-- -----------------------------------------------------------------------------

DROP PROCEDURE IF EXISTS _add_totp_columns;

DELIMITER $$

CREATE PROCEDURE _add_totp_columns()
BEGIN
    -- totp_secret: base32-encoded shared secret provisioned when the user
    -- pairs their authenticator app. NULL until the user enables MFA.
    -- 64 chars comfortably holds a 40-byte base32 secret with padding.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'users'
          AND COLUMN_NAME  = 'totp_secret'
    ) THEN
        ALTER TABLE users
            ADD COLUMN totp_secret VARCHAR(64) NULL DEFAULT NULL
                COMMENT 'Base32 TOTP shared secret; NULL until MFA is enrolled';
    END IF;

    -- totp_enabled: explicit on/off flag separate from the secret so that
    -- a partially-enrolled user (secret generated, QR shown, not yet verified)
    -- does not accidentally get locked behind MFA before confirming the code.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'users'
          AND COLUMN_NAME  = 'totp_enabled'
    ) THEN
        ALTER TABLE users
            ADD COLUMN totp_enabled TINYINT(1) NOT NULL DEFAULT 0
                COMMENT '1 = MFA is active and enforced at login';
    END IF;

    -- totp_backup_codes: JSON array of hashed single-use recovery codes.
    -- Application layer marks used codes by removing them from the array on
    -- successful redemption, so the column always reflects remaining codes.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'users'
          AND COLUMN_NAME  = 'totp_backup_codes'
    ) THEN
        ALTER TABLE users
            ADD COLUMN totp_backup_codes JSON NULL DEFAULT NULL
                COMMENT 'Hashed one-time recovery codes; app removes used entries';
    END IF;
END$$

DELIMITER ;

CALL _add_totp_columns();

DROP PROCEDURE IF EXISTS _add_totp_columns;
