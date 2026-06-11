<?php
/**
 * WebhookDispatcher — fire-and-forget outbound webhook delivery.
 *
 * WHY THIS EXISTS
 * ---------------
 * Site operators integrate FlomiPost with external CRMs, dashboards, and
 * monitoring tools. Rather than polling the FlomiPost API, they register a
 * URL and receive push notifications when posts change state. Delivery is
 * best-effort with a hard 5-second timeout so a slow or dead endpoint never
 * blocks a publish cycle.
 *
 * COMMON EVENTS
 * -------------
 *   'post.sent'      — publisher confirmed delivery to the channel API
 *   'post.failed'    — publisher received an error from the channel API
 *   'post.approved'  — ApprovalGate::approve() was called
 *   'post.rejected'  — ApprovalGate::reject() was called
 *
 * INTEGRATION
 * -----------
 * Fire AFTER a successful (or failed) send in each publisher:
 *
 *     require_once __DIR__ . '/../Webhooks/WebhookDispatcher.php';
 *     $dispatcher = new WebhookDispatcher($pdo);
 *     $dispatcher->dispatch($post['site_id'], 'post.sent', [
 *         'post_id'    => $post['id'],
 *         'channel'    => 'whatsapp',
 *         'sent_at'    => date('c'),
 *     ]);
 *
 * The call is synchronous but capped at 5 s per endpoint; do not call it
 * inside a transaction that must stay short.
 */

declare(strict_types=1);

final class WebhookDispatcher
{
    public function __construct(private \PDO $pdo) {}

    /**
     * Deliver $payload to every active webhook registered for $siteId that
     * subscribes to $event. Failures are logged but never thrown — a broken
     * webhook must not prevent the publish flow from completing.
     */
    public function dispatch(int $siteId, string $event, array $payload): void
    {
        // LIKE search is intentionally loose; store events as comma-separated
        // or JSON array strings, e.g. "post.sent,post.failed". Structured
        // storage would be cleaner but this avoids a join table for now.
        $stmt = $this->pdo->prepare(
            'SELECT id, url, secret
             FROM webhooks
             WHERE site_id = :site_id AND active = 1 AND events LIKE :event_pattern'
        );
        $stmt->execute([
            ':site_id'       => $siteId,
            ':event_pattern' => '%' . $event . '%',
        ]);

        $hooks = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        if (empty($hooks)) {
            return;
        }

        $jsonBody = json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);

        foreach ($hooks as $hook) {
            $this->deliver((int) $hook['id'], $hook['url'], $hook['secret'] ?? '', $event, $jsonBody);
        }
    }

    // -----------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------

    private function deliver(
        int $webhookId,
        string $url,
        string $secret,
        string $event,
        string $jsonBody
    ): void {
        $headers = [
            'Content-Type: application/json',
            'X-FlomiPost-Event: ' . $event,
        ];

        // Sign only when the operator has set a secret; unsigned webhooks are
        // allowed for internal/trusted endpoints to keep setup friction low.
        if ($secret !== '') {
            $sig = hash_hmac('sha256', $jsonBody, $secret);
            $headers[] = 'X-FlomiPost-Signature: sha256=' . $sig;
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            \CURLOPT_POST           => true,
            \CURLOPT_POSTFIELDS     => $jsonBody,
            \CURLOPT_HTTPHEADER     => $headers,
            \CURLOPT_RETURNTRANSFER => true,
            \CURLOPT_TIMEOUT        => 5,          // hard cap; slow hooks are silently abandoned
            \CURLOPT_CONNECTTIMEOUT => 3,
        ]);

        $responseBody = curl_exec($ch);
        $responseCode = (int) curl_getinfo($ch, \CURLINFO_HTTP_CODE);
        $curlError    = curl_error($ch);
        curl_close($ch);

        // Delivery outcome is logged regardless of success/failure so operators
        // can debug their endpoint without needing server logs.
        $this->logDelivery(
            $webhookId,
            $responseCode,
            is_string($responseBody) ? substr($responseBody, 0, 2000) : $curlError
        );
    }

    private function logDelivery(int $webhookId, int $responseCode, string $responseBody): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO webhook_deliveries (webhook_id, response_code, response_body, delivered_at)
             VALUES (:webhook_id, :response_code, :response_body, NOW())'
        );
        $stmt->execute([
            ':webhook_id'     => $webhookId,
            ':response_code'  => $responseCode,
            ':response_body'  => $responseBody,
        ]);
    }
}
