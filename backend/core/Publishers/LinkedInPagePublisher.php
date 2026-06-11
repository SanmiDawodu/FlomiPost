<?php
class LinkedInPagePublisher extends AbstractPublisher {
    public function publish(?array $conn, array $target, array $post, array $media): array {
        if (!$conn) throw new RuntimeException('LinkedIn Page: no connected account');
        $token   = Crypto::dec($conn['access_token']);
        $ownerId = $conn['account_id'];
        $text    = strip_tags($post['caption'] ?? '');

        if (!$token) throw new RuntimeException('LinkedIn Page: no access token');

        // Page URN should be urn:li:organization:XXX
        if (!str_starts_with($ownerId, 'urn:li:organization:') && is_numeric($ownerId)) {
            $ownerId = 'urn:li:organization:' . $ownerId;
        }

        $linkUrl = $post['link_url'] ?? null;
        if ($linkUrl && !str_contains($text, $linkUrl)) {
            $text = rtrim($text) . "\n\n" . $linkUrl;
        }
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
        throw new RuntimeException('LinkedIn Page: ' . json_encode($r));
    }
}
