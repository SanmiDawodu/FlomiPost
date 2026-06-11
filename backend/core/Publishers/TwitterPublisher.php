<?php
class TwitterPublisher extends AbstractPublisher {
    public function publish(?array $conn, array $target, array $post, array $media): array {
        if (!$conn) throw new RuntimeException('Twitter: no connected account');
        $token       = Crypto::dec($conn['access_token']);
        $tokenSecret = Crypto::dec($conn['extra'] ?? '');
        $text        = strip_tags($post['caption'] ?? '');
        
        // X/Twitter API v2 - OAuth 1.0a
        $consumerKey    = getenv('TWITTER_API_KEY') ?: getenv('TIKTOK_CLIENT_ID');
        $consumerSecret = getenv('TWITTER_API_SECRET') ?: '';
        
        if (!$token) throw new RuntimeException('Twitter: no access token');
        
        // Build tweet - truncate to 280 chars
        $tweetText = mb_substr($text, 0, 280);
        
        $url     = 'https://api.twitter.com/2/tweets';
        $payload = ['text' => $tweetText];
        
        // Add media if available
        if (!empty($media) && !empty($media[0]['url'])) {
            // Media upload would need separate OAuth call - skip for now
        }
        
        // Use Bearer token if available (OAuth 2.0)
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($payload),
            CURLOPT_HTTPHEADER     => [
                "Authorization: Bearer $token",
                'Content-Type: application/json',
            ],
            CURLOPT_TIMEOUT => 20,
        ]);
        $r = json_decode(curl_exec($ch), true); curl_close($ch);
        
        if (isset($r['data']['id'])) {
            return ['id' => $r['data']['id'], 'url' => 'https://twitter.com/i/web/status/'.$r['data']['id']];
        }
        throw new RuntimeException('Twitter: ' . json_encode($r['errors'] ?? $r));
    }
}
