<?php
/**
 * TOTPAuthenticator — RFC 6238 TOTP second factor, no external library.
 *
 * WHY THIS EXISTS
 * ---------------
 * FlomiPost manages outbound messaging to real audiences; a compromised
 * account can cause an immediate spam incident (see June 2026). TOTP adds a
 * second factor that doesn't require SMS infrastructure, works offline, and
 * is compatible with every standard authenticator app (Google Authenticator,
 * Authy, 1Password, etc.).
 *
 * INTEGRATION
 * -----------
 * Wire into the login flow AFTER the password check:
 *
 *     require_once __DIR__ . '/../Auth/TOTPAuthenticator.php';
 *     $totp = new TOTPAuthenticator();
 *
 *     // Enrolment (one-time, on the 2FA settings page):
 *     $secret = $totp->generateSecret();
 *     // store $secret encrypted in users.totp_secret
 *     $uri = $totp->getProvisioningUri($secret, $user['email']);
 *     // render $uri as a QR code via a JS library (e.g. qrcode.js)
 *
 *     // Login (every time, after password verified):
 *     if ((int)($user['totp_enabled'] ?? 0) === 1) {
 *         $code = $_POST['totp_code'] ?? '';
 *         if (!$totp->verify($user['totp_secret'], $code)) {
 *             // return 401 — do NOT proceed to session creation
 *         }
 *     }
 *
 *     // Backup codes — generate at enrolment, store hashed, consume on use:
 *     $codes = $totp->generateBackupCodes();
 *
 * NOTES
 * -----
 * - totp_secret should be stored AES-encrypted at rest; decrypt before
 *   passing to verify().
 * - $window=1 tolerates ±30 s clock skew (one step either side). Raise to 2
 *   only if users report consistent verification failures.
 * - This is a pure-PHP implementation to avoid a Composer dependency in the
 *   auth hot-path. If you later add otphp/otphp via Composer, remove this
 *   class and update the require_once.
 */

declare(strict_types=1);

final class TOTPAuthenticator
{
    private const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    /** Generate a 16-character Base32 secret suitable for TOTP enrolment. */
    public function generateSecret(): string
    {
        // 10 random bytes = 80 bits; Base32-encoded at 5 bits/char = 16 chars.
        $bytes  = random_bytes(10);
        $secret = '';

        // Walk the raw bytes 5 bits at a time to build the Base32 string.
        $buffer = 0;
        $bitsLeft = 0;
        foreach (str_split($bytes) as $byte) {
            $buffer   = ($buffer << 8) | ord($byte);
            $bitsLeft += 8;
            while ($bitsLeft >= 5) {
                $bitsLeft -= 5;
                $secret   .= self::BASE32_CHARS[($buffer >> $bitsLeft) & 0x1F];
            }
        }

        return $secret;
    }

    /**
     * Build the otpauth URI used to populate a QR code for authenticator apps.
     * The label format "Issuer:email" is the standard most apps display.
     */
    public function getProvisioningUri(string $secret, string $email, string $issuer = 'FlomiPost'): string
    {
        $label = rawurlencode($issuer . ':' . $email);

        return sprintf(
            'otpauth://totp/%s?secret=%s&issuer=%s&algorithm=SHA1&digits=6&period=30',
            $label,
            $secret,
            rawurlencode($issuer)
        );
    }

    /**
     * Verify a 6-digit TOTP code against $secret.
     * Checks the current time step plus $window steps in each direction to
     * accommodate clock skew between the server and the user's device.
     */
    public function verify(string $secret, string $code, int $window = 1): bool
    {
        // Normalise: authenticator apps may display codes with a space in the middle
        $code = str_replace(' ', '', trim($code));

        if (!preg_match('/^\d{6}$/', $code)) {
            return false;
        }

        $decodedSecret = $this->base32Decode($secret);
        $timeStep      = (int) floor(time() / 30);

        for ($offset = -$window; $offset <= $window; $offset++) {
            if ($this->hotp($decodedSecret, $timeStep + $offset) === $code) {
                return true;
            }
        }

        return false;
    }

    /**
     * Generate $count one-time backup codes. Store them hashed (password_hash)
     * in users_backup_codes and compare with password_verify on use.
     */
    public function generateBackupCodes(int $count = 8): array
    {
        $codes = [];
        for ($i = 0; $i < $count; $i++) {
            $codes[] = bin2hex(random_bytes(5));   // 10 hex chars, easy to type
        }
        return $codes;
    }

    // -----------------------------------------------------------------
    // Private RFC 4226 / RFC 6238 internals
    // -----------------------------------------------------------------

    /** Compute a single HOTP value for the given counter. */
    private function hotp(string $secret, int $counter): string
    {
        // Pack counter as 8-byte big-endian (RFC 4226 §5.1)
        $counterBytes = pack('N*', 0) . pack('N*', $counter);

        $hmac = hash_hmac('sha1', $counterBytes, $secret, true);

        // Dynamic truncation (RFC 4226 §5.3)
        $offset = ord($hmac[19]) & 0x0F;
        $code   = (
            ((ord($hmac[$offset])     & 0x7F) << 24)
          | ((ord($hmac[$offset + 1]) & 0xFF) << 16)
          | ((ord($hmac[$offset + 2]) & 0xFF) <<  8)
          |  (ord($hmac[$offset + 3]) & 0xFF)
        ) % 1_000_000;

        return str_pad((string) $code, 6, '0', STR_PAD_LEFT);
    }

    /** Decode a Base32 string to raw binary. Case-insensitive, padding optional. */
    private function base32Decode(string $input): string
    {
        $input  = strtoupper(rtrim($input, '='));
        $output = '';
        $buffer = 0;
        $bitsLeft = 0;

        foreach (str_split($input) as $char) {
            $val = strpos(self::BASE32_CHARS, $char);
            if ($val === false) {
                continue;   // skip unknown chars rather than throwing — tolerates spaces/dashes
            }
            $buffer    = ($buffer << 5) | $val;
            $bitsLeft += 5;
            if ($bitsLeft >= 8) {
                $bitsLeft -= 8;
                $output   .= chr(($buffer >> $bitsLeft) & 0xFF);
            }
        }

        return $output;
    }
}
