<?php
/**
 * GoogleBusinessOAuth — OAuth2 + API helper for Google Business Profile
 * (formerly "Google My Business"). Mirrors the other *OAuth.php helpers
 * (YouTubeOAuth / GAOAuth) so the connect flow in index.php stays uniform.
 *
 * Uses a DEDICATED Google Cloud OAuth client (separate from the GA client):
 *   GOOGLE_BUSINESS_CLIENT_ID
 *   GOOGLE_BUSINESS_CLIENT_SECRET
 *   GOOGLE_BUSINESS_REDIRECT_URI  (default below)
 *
 * Scope: https://www.googleapis.com/auth/business.manage
 *
 * Discovery uses the v1 Account Management + Business Information APIs;
 * publishing (see GoogleBusinessPublisher) uses the still-active v4
 * localPosts endpoint.
 */
class GoogleBusinessOAuth {
    const SCOPE = 'https://www.googleapis.com/auth/business.manage';

    public static function clientId(): string     { return getenv('GOOGLE_BUSINESS_CLIENT_ID') ?: ''; }
    public static function clientSecret(): string  { return getenv('GOOGLE_BUSINESS_CLIENT_SECRET') ?: ''; }
    public static function redirectUri(): string {
        return getenv('GOOGLE_BUSINESS_REDIRECT_URI')
            ?: 'https://scheduler.flomicso.dev/api/oauth/google_business/callback';
    }

    public static function authUrl(string $state): string {
        $params = [
            'client_id'              => self::clientId(),
            'redirect_uri'           => self::redirectUri(),
            'response_type'          => 'code',
            'scope'                  => self::SCOPE,
            'access_type'            => 'offline', // ask Google for a refresh_token
            'prompt'                 => 'consent',  // force a refresh_token on every connect
            'include_granted_scopes' => 'true',
            'state'                  => $state,
        ];
        return 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query($params);
    }

    public static function exchangeCode(string $code): array {
        return self::tokenRequest([
            'code'          => $code,
            'client_id'     => self::clientId(),
            'client_secret' => self::clientSecret(),
            'redirect_uri'  => self::redirectUri(),
            'grant_type'    => 'authorization_code',
        ]);
    }

    public static function refreshToken(string $refreshToken): array {
        return self::tokenRequest([
            'client_id'     => self::clientId(),
            'client_secret' => self::clientSecret(),
            'refresh_token' => $refreshToken,
            'grant_type'    => 'refresh_token',
        ]);
    }

    private static function tokenRequest(array $fields): array {
        $ch = curl_init('https://oauth2.googleapis.com/token');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => http_build_query($fields),
            CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
            CURLOPT_TIMEOUT        => 30,
        ]);
        $raw = curl_exec($ch); $err = curl_error($ch); curl_close($ch);
        if ($raw === false) throw new RuntimeException("Google token HTTP error: {$err}");
        $d = json_decode($raw, true) ?: [];
        if (empty($d['access_token'])) {
            $msg = $d['error_description'] ?? $d['error'] ?? $raw;
            throw new RuntimeException("Google OAuth token error: {$msg}");
        }
        return $d;
    }

    /** GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts -> [ {name:"accounts/123", accountName, ...} ] */
    public static function listAccounts(string $accessToken): array {
        $r = self::apiGet('https://mybusinessaccountmanagement.googleapis.com/v1/accounts?pageSize=100', $accessToken);
        return $r['accounts'] ?? [];
    }

    /**
     * GET .../v1/{account}/locations  ($account = "accounts/123").
     * The Business Information API requires an explicit readMask.
     * Returns [ {name:"locations/456", title, storefrontAddress, ...} ].
     */
    public static function listLocations(string $accessToken, string $accountName): array {
        $url = 'https://mybusinessbusinessinformation.googleapis.com/v1/' . $accountName
             . '/locations?readMask=name,title,storefrontAddress&pageSize=100';
        $r = self::apiGet($url, $accessToken);
        return $r['locations'] ?? [];
    }

    private static function apiGet(string $url, string $accessToken): array {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => ["Authorization: Bearer {$accessToken}"],
            CURLOPT_TIMEOUT        => 30,
        ]);
        $raw = curl_exec($ch); $err = curl_error($ch); curl_close($ch);
        if ($raw === false) throw new RuntimeException("Google API HTTP error: {$err}");
        $d = json_decode($raw, true) ?: [];
        if (!empty($d['error'])) {
            $msg = $d['error']['message'] ?? json_encode($d['error']);
            throw new RuntimeException("Google Business API: {$msg}");
        }
        return $d;
    }
}
