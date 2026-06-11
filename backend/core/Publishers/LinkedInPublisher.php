<?php
class LinkedInPublisher extends AbstractPublisher {
    public function publish(?array $conn, array $target, array $post, array $media): array {
        if (!$conn) throw new RuntimeException('LinkedIn: no connected account');
        $token   = Crypto::dec($conn['access_token']);
        $ownerId = $conn['account_id'];
        $text    = strip_tags($post['caption'] ?? '');

        if (!$token) throw new RuntimeException('LinkedIn: no access token');

        // Resolve owner URN
        if (!str_starts_with($ownerId, 'urn:')) {
            $ch = curl_init('https://api.linkedin.com/v2/userinfo');
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true,
                CURLOPT_HTTPHEADER=>["Authorization: Bearer $token"]]);
            $profile = json_decode(curl_exec($ch), true); curl_close($ch);
            $ownerId = 'urn:li:person:' . ($profile['sub'] ?? $ownerId);
        }

        // Append link if available
        $linkUrl = $post['link_url'] ?? null;
        if ($linkUrl && !str_contains($text, $linkUrl)) {
            $text = rtrim($text) . "\n\n" . $linkUrl;
        }

        // Append first media URL as link if image (LinkedIn free API doesn't support image upload)
        if (!empty($media) && !$linkUrl) {
            $imgUrl = $media[0]['url'] ?? null;
            if ($imgUrl) $text = rtrim($text) . "\n\n" . $imgUrl;
        }

        $payload = [
            'author'          => $ownerId,
            'lifecycleState'  => 'PUBLISHED',
            'specificContent' => [
                'com.linkedin.ugc.ShareContent' => [
                    'shareCommentary'    => ['text' => mb_substr($text, 0, 3000)],
                    'shareMediaCategory' => 'NONE',
                ]
            ],
            'visibility' => ['com.linkedin.ugc.MemberNetworkVisibility' => 'PUBLIC'],
        ];

        $ch = curl_init('https://api.linkedin.com/v2/ugcPosts');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
            CURLOPT_POSTFIELDS     => json_encode($payload),
            CURLOPT_HTTPHEADER     => [
                "Authorization: Bearer $token",
                'Content-Type: application/json',
                'X-Restli-Protocol-Version: 2.0.0'
            ],
            CURLOPT_TIMEOUT => 20,
        ]);
        $r = json_decode(curl_exec($ch), true); curl_close($ch);

        if (isset($r['id'])) return ['id' => $r['id'], 'url' => null];
        throw new RuntimeException('LinkedIn: ' . json_encode($r));
    }
}
