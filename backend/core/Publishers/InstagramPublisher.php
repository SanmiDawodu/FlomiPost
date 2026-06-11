<?php
// Posts to Instagram Business via Graph API (2-step: create container -> publish).
// Connection: access_token=page_access_token, account_id=ig_user_id
class InstagramPublisher extends AbstractPublisher {
    private string $base = 'https://graph.facebook.com/v19.0';

    public function publish(?array $connection, array $target, array $post, array $media): array {
        $conn   = $this->requireConnection($connection, 'Instagram');
        $token  = Crypto::dec($conn['access_token'] ?? '');
        $igId   = $conn['account_id'] ?? '';
        if (!$token || !$igId) throw new RuntimeException('Instagram connection missing token or IG user ID');

        $text = $this->composeText($post);
        // Filter out audio - Instagram doesn't support audio posts
        $imgs = array_values(array_filter($media, fn($m) => $m['type'] === 'image'));
        $vids = array_values(array_filter($media, fn($m) => $m['type'] === 'video'));
        // Note: audio files are skipped silently for Instagram

        if (!empty($vids)) {
            return $this->publishReel($igId, $token, $vids[0]['url'], $text);
        } elseif (count($imgs) > 1) {
            return $this->publishCarousel($igId, $token, $imgs, $text);
        } elseif (count($imgs) === 1) {
            return $this->publishPhoto($igId, $token, $imgs[0]['url'], $text);
        } else {
            throw new RuntimeException('Instagram requires at least one image or video. Audio-only posts are not supported on Instagram.');
        }
    }

    private function publishPhoto(string $igId, string $token, string $imgUrl, string $caption): array {
        $container = $this->igPost("/{$igId}/media", ['image_url' => $imgUrl, 'caption' => $caption, 'access_token' => $token]);
        $cid = $container['id'] ?? null;
        if (!$cid) throw new RuntimeException('Instagram: failed to create media container');
        $this->waitForContainer($cid, $token);
        $r = $this->igPost("/{$igId}/media_publish", ['creation_id' => $cid, 'access_token' => $token]);
        $id = $r['id'] ?? null;
        return ['id' => $id, 'url' => $id ? "https://www.instagram.com/p/{$id}/" : null];
    }

    private function publishReel(string $igId, string $token, string $videoUrl, string $caption): array {
        $container = $this->igPost("/{$igId}/media", ['media_type' => 'REELS', 'video_url' => $videoUrl, 'caption' => $caption, 'access_token' => $token]);
        $cid = $container['id'] ?? null;
        if (!$cid) throw new RuntimeException('Instagram: failed to create reel container');
        $this->waitForContainer($cid, $token, 30);
        $r = $this->igPost("/{$igId}/media_publish", ['creation_id' => $cid, 'access_token' => $token]);
        $id = $r['id'] ?? null;
        return ['id' => $id, 'url' => $id ? "https://www.instagram.com/reel/{$id}/" : null];
    }

    private function publishCarousel(string $igId, string $token, array $imgs, string $caption): array {
        $childIds = [];
        foreach ($imgs as $img) {
            $c = $this->igPost("/{$igId}/media", ['image_url' => $img['url'], 'is_carousel_item' => true, 'access_token' => $token]);
            if (empty($c['id'])) throw new RuntimeException('Instagram: failed to create carousel item');
            $childIds[] = $c['id'];
        }
        $container = $this->igPost("/{$igId}/media", ['media_type' => 'CAROUSEL', 'children' => implode(',', $childIds), 'caption' => $caption, 'access_token' => $token]);
        $cid = $container['id'] ?? null;
        if (!$cid) throw new RuntimeException('Instagram: failed to create carousel container');
        $this->waitForContainer($cid, $token);
        $r = $this->igPost("/{$igId}/media_publish", ['creation_id' => $cid, 'access_token' => $token]);
        $id = $r['id'] ?? null;
        return ['id' => $id, 'url' => $id ? "https://www.instagram.com/p/{$id}/" : null];
    }

    private function waitForContainer(string $cid, string $token, int $maxWait = 15): void {
        $url = "{$this->base}/{$cid}?fields=status_code&access_token={$token}";
        for ($i = 0; $i < $maxWait; $i++) {
            sleep(2);
            $ch = curl_init($url); curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
            $r = json_decode(curl_exec($ch), true); curl_close($ch);
            $status = $r['status_code'] ?? '';
            if ($status === 'FINISHED') return;
            if ($status === 'ERROR') throw new RuntimeException('Instagram: media processing failed');
        }
        throw new RuntimeException('Instagram: media processing timed out');
    }

    private function igPost(string $path, array $payload): array {
        $ch = curl_init($this->base . $path);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_SLASHES),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT => 60,
        ]);
        $raw = curl_exec($ch); $err = curl_error($ch); curl_close($ch);
        if ($raw === false) throw new RuntimeException("HTTP error: {$err}");
        $d = json_decode($raw, true);
        if (!empty($d['error'])) throw new RuntimeException('Instagram API: ' . ($d['error']['message'] ?? $raw));
        return $d;
    }
}
