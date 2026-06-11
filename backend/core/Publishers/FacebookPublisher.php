<?php
// Posts to a Facebook Page. Connection: access_token=page_access_token, account_id=page_id, extra.page_name
class FacebookPublisher extends AbstractPublisher {
    public function publish(?array $connection, array $target, array $post, array $media): array {
        $conn  = $this->requireConnection($connection, 'Facebook');
        $token = Crypto::dec($conn['access_token'] ?? '');
        $pageId = $conn['account_id'] ?? '';
        if (!$token || !$pageId) throw new RuntimeException('Facebook connection missing page token or page ID');

        $text = $this->composeText($post);
        $base = "https://graph.facebook.com/v19.0/{$pageId}";

        $imgs = array_values(array_filter($media, fn($m) => $m['type'] === 'image'));
        $vids = array_values(array_filter($media, fn($m) => $m['type'] === 'video'));

        if (!empty($vids)) {
            // Video post
            $v = $vids[0];
            $r = $this->fbPost("{$base}/videos", ['file_url' => $v['url'], 'description' => $text, 'access_token' => $token]);
        } elseif (count($imgs) > 1) {
            // Multi-photo post via attached_media
            $photoIds = [];
            foreach ($imgs as $img) {
                $pr = $this->fbPost("{$base}/photos", ['url' => $img['url'], 'published' => false, 'access_token' => $token]);
                if (empty($pr['data']['id'])) throw new RuntimeException('Facebook: failed to stage photo');
                $photoIds[] = ['media_fbid' => $pr['data']['id']];
            }
            $r = $this->fbPost("{$base}/feed", ['message' => $text, 'attached_media' => $photoIds, 'access_token' => $token]);
        } elseif (count($imgs) === 1) {
            $r = $this->fbPost("{$base}/photos", ['url' => $imgs[0]['url'], 'caption' => $text, 'access_token' => $token]);
        } else {
            $r = $this->fbPost("{$base}/feed", ['message' => $text, 'access_token' => $token]);
        }

        if (!empty($r['data']['error'])) {
            $msg = $r['data']['error']['message'] ?? 'unknown error';
            throw new RuntimeException("Facebook API: {$msg}");
        }
        $id  = $r['data']['id'] ?? null;
        $url = $id ? "https://facebook.com/{$id}" : null;
        return ['id' => $id, 'url' => $url];
    }

    private function fbPost(string $url, array $payload): array {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_SLASHES),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT => 60,
        ]);
        $raw = curl_exec($ch); $err = curl_error($ch); curl_close($ch);
        if ($raw === false) throw new RuntimeException("HTTP error: {$err}");
        return ['data' => json_decode($raw, true), 'raw' => $raw];
    }
}
