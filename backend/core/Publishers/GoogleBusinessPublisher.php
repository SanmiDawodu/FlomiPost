<?php
// Posts a "Google Post" (local post) to a Google Business Profile location.
// Connection: account_id = "accounts/{acct}/locations/{loc}" (the v4 parent path),
//   access_token = encrypted Google access token, refresh_token = encrypted refresh
//   token (set by the OAuth connect flow). Google access tokens live ~1h, so we
//   proactively refresh from the refresh_token at publish time.
//
// API: POST https://mybusiness.googleapis.com/v4/{parent}/localPosts
//      scope https://www.googleapis.com/auth/business.manage
//      (the v1 Business Profile APIs never absorbed localPosts; v4 is still live).
class GoogleBusinessPublisher extends AbstractPublisher {
    public function publish(?array $connection, array $target, array $post, array $media): array {
        $conn    = $this->requireConnection($connection, 'Google Business');
        $parent  = $conn['account_id'] ?? '';
        if (!$parent) throw new RuntimeException('Google Business connection missing location (account_id)');

        $token   = Crypto::dec($conn['access_token'] ?? '');
        $refresh = !empty($conn['refresh_token']) ? Crypto::dec($conn['refresh_token']) : '';

        // Google access tokens expire in ~1h; a scheduled post almost always fires
        // after that, so refresh up front when we have a refresh token and persist
        // the new access token back to the connection.
        if ($refresh) {
            try {
                $new = GoogleBusinessOAuth::refreshToken($refresh);
                if (!empty($new['access_token'])) {
                    $token = $new['access_token'];
                    DB::update('platform_connections', ['access_token' => Crypto::enc($token)], 'id=?', [(int)$conn['id']]);
                }
            } catch (Throwable $e) {
                // Fall back to the stored token; if it's also expired the POST below surfaces it.
            }
        }
        if (!$token) throw new RuntimeException('Google Business: no access token — reconnect the account');

        $summary = mb_substr($this->composeText($post), 0, 1500);
        $body = [
            'languageCode' => 'en-US',
            'summary'      => $summary,
            'topicType'    => 'STANDARD',
        ];

        // Google Posts support a single photo (no carousel / video).
        $imgs = array_values(array_filter($media, fn($m) => ($m['type'] ?? '') === 'image'));
        if (!empty($imgs) && !empty($imgs[0]['url'])) {
            $body['media'] = [['mediaFormat' => 'PHOTO', 'sourceUrl' => $imgs[0]['url']]];
        }

        // A link on the post becomes a "Learn more" call-to-action button.
        $linkUrl = $post['link_url'] ?? null;
        if ($linkUrl) {
            $body['callToAction'] = ['actionType' => 'LEARN_MORE', 'url' => $linkUrl];
        }

        $url = "https://mybusiness.googleapis.com/v4/{$parent}/localPosts";
        [$status, $resp] = $this->post($url, $body, $token);

        if (!empty($resp['name'])) {
            return ['id' => $resp['name'], 'url' => $resp['searchUrl'] ?? null];
        }
        $msg = $resp['error']['message'] ?? ('HTTP ' . $status . ' ' . json_encode($resp));
        throw new RuntimeException("Google Business: {$msg}");
    }

    /** @return array{0:int,1:array} [http_status, decoded_body] */
    private function post(string $url, array $payload, string $token): array {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            CURLOPT_HTTPHEADER     => [
                "Authorization: Bearer {$token}",
                'Content-Type: application/json',
            ],
            CURLOPT_TIMEOUT        => 60,
        ]);
        $raw    = curl_exec($ch);
        $err    = curl_error($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($raw === false) throw new RuntimeException("HTTP error: {$err}");
        return [$status, json_decode($raw, true) ?: []];
    }
}
