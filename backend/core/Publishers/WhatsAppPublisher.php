<?php
/**
 * WhatsAppPublisher — handles WhatsApp Cloud API delivery for post_targets
 * with platform key_name = 'whatsapp' or 'whatsapp_channel'.
 *
 * Fan-out blasts to contact lists go through /whatsapp/test (index.php)
 * which has RecipientGuard wired in. This publisher handles single-target
 * scheduled posts queued via publish_queue.
 */
class WhatsAppPublisher extends AbstractPublisher {
    public function publish(?array $conn, array $target, array $post, array $media): array {
        if (!$conn) throw new \RuntimeException('WhatsApp: no connected account');

        $token   = Crypto::dec($conn['access_token'] ?? '');
        $phoneId = $conn['account_id'] ?? '';
        $to      = $target['recipient'] ?? $target['platform_account_id'] ?? '';

        if (!$token || !$phoneId || !$to) {
            throw new \RuntimeException('WhatsApp: missing token, phone_number_id, or recipient');
        }

        $text = $this->composeText($post);

        $imgs  = array_values(array_filter($media, fn($m) => ($m['type'] ?? '') === 'image'));
        $vids  = array_values(array_filter($media, fn($m) => ($m['type'] ?? '') === 'video'));

        if (!empty($vids)) {
            $payload = [
                'messaging_product' => 'whatsapp',
                'recipient_type'    => 'individual',
                'to'                => $to,
                'type'              => 'video',
                'video'             => ['link' => $vids[0]['url'], 'caption' => $text],
            ];
        } elseif (!empty($imgs)) {
            $payload = [
                'messaging_product' => 'whatsapp',
                'recipient_type'    => 'individual',
                'to'                => $to,
                'type'              => 'image',
                'image'             => ['link' => $imgs[0]['url'], 'caption' => $text],
            ];
        } else {
            $payload = [
                'messaging_product' => 'whatsapp',
                'recipient_type'    => 'individual',
                'to'                => $to,
                'type'              => 'text',
                'text'              => ['body' => $text, 'preview_url' => true],
            ];
        }

        $url = "https://graph.facebook.com/v19.0/{$phoneId}/messages";
        $ch  = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($payload),
            CURLOPT_HTTPHEADER     => [
                "Authorization: Bearer {$token}",
                'Content-Type: application/json',
            ],
            CURLOPT_TIMEOUT => 20,
        ]);
        $raw = curl_exec($ch);
        curl_close($ch);
        $r = json_decode($raw, true);

        if (isset($r['messages'][0]['id'])) {
            return ['id' => $r['messages'][0]['id'], 'url' => null];
        }

        throw new \RuntimeException(
            'WhatsApp API error: ' . ($r['error']['message'] ?? $raw)
        );
    }
}
