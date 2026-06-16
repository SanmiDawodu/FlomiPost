-- Google Business Profile (Google My Business) publishing channel.
--
-- The `google_business` platform row already exists on the live DB (it shows as
-- a "Connect manually" card today). This migration is an idempotent safety net
-- so fresh installs also get the platform; it is a no-op where the row exists.
INSERT INTO platforms (key_name, name, color, active)
SELECT * FROM (SELECT 'google_business', 'Google Business', '#4285F4', 1) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM platforms WHERE key_name = 'google_business');
