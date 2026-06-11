<?php
/**
 * RecipientGuard — fail-closed safety gate for outbound blasts.
 *
 * WHY THIS EXISTS
 * ---------------
 * The June 2026 spam incident happened because a post with no segment target
 * fell through to "send to everyone", and the cron re-ran and sent again. The
 * existing "LIMIT 100 if no segment" rule is a band-aid: it still sends, just
 * to fewer people, and it depends on a human remembering to set segment_id.
 *
 * This guard inverts the default to FAIL CLOSED:
 *   - No explicit segment/target  -> throw, send nothing.
 *   - More recipients than the cap -> throw, unless the caller passes an
 *                                     explicit confirmed count that matches.
 *   - Already sent for this post   -> skipped via the send_ledger UNIQUE key.
 *
 * INTEGRATION (do this, then test on a tiny segment before any real blast)
 * ------------------------------------------------------------------------
 * In each publisher (WhatsAppPublisher.php, SMSPublisher.php, and any other
 * fan-out publisher in core/Publishers/), BEFORE building the recipient list:
 *
 *     require_once __DIR__ . '/../Safety/RecipientGuard.php';
 *     $guard = new RecipientGuard($pdo);                  // $pdo = your PDO handle
 *     $guard->assertTargeted($post);                      // throws if no segment
 *
 * Then resolve recipients as you do today, and for EACH recipient gate the
 * actual send with the idempotency check so a cron re-run can't double-send:
 *
 *     if (!$guard->claim($post['id'], $connectionId, 'whatsapp', $recipientPhone,
 *                        $post['site_id'] ?? null, $post['segment_id'] ?? null)) {
 *         continue; // already sent for this post on this connection
 *     }
 *     // ... perform the actual API send ...
 *     $guard->markStatus($post['id'], $connectionId, $recipientPhone, $ok ? 'sent' : 'failed');
 *
 * And cap the batch once recipients are resolved:
 *
 *     $guard->assertWithinCap(count($recipients), $post['confirmed_recipient_count'] ?? null);
 *
 * NOTES
 * -----
 * - PDO is injected so this class makes no assumption about your config/DB
 *   layer. If you use mysqli, adapt the three query helpers at the bottom.
 * - Adjust the column names in segmentHasRecipients() to match your schema
 *   (build notes: sms_contacts has site_id + segment_id).
 */

declare(strict_types=1);

final class RecipientGuard
{
    /** Hard ceiling. A blast above this MUST pass a matching confirmed count. */
    public int $maxRecipientsWithoutConfirmation = 50;

    public function __construct(private \PDO $pdo) {}

    /**
     * Fail closed if the post has no explicit, non-empty segment target.
     * This is the single most important rule: no target => no send.
     */
    public function assertTargeted(array $post): void
    {
        $segmentId = $post['segment_id'] ?? null;

        if ($segmentId === null || $segmentId === '' || (int) $segmentId <= 0) {
            throw new \RuntimeException(sprintf(
                'RecipientGuard: post %s has no segment_id. Refusing to send. '
                . 'Set an explicit segment before publishing (no implicit send-to-all).',
                (string) ($post['id'] ?? '?')
            ));
        }

        if (!$this->segmentHasRecipients((int) ($post['site_id'] ?? 0), (int) $segmentId)) {
            throw new \RuntimeException(sprintf(
                'RecipientGuard: segment %d (site %s) resolved to 0 recipients. '
                . 'Refusing to send.',
                (int) $segmentId,
                (string) ($post['site_id'] ?? '?')
            ));
        }
    }

    /**
     * Refuse a batch larger than the cap unless the caller passes a confirmed
     * count that exactly matches the resolved recipient count. This forces a
     * deliberate "yes, I really mean to message N people" decision for big
     * sends instead of it happening silently.
     */
    public function assertWithinCap(int $resolvedCount, ?int $confirmedCount = null): void
    {
        if ($resolvedCount <= $this->maxRecipientsWithoutConfirmation) {
            return;
        }
        if ($confirmedCount === null || $confirmedCount !== $resolvedCount) {
            throw new \RuntimeException(sprintf(
                'RecipientGuard: blast of %d recipients exceeds the unconfirmed cap '
                . 'of %d. Pass an explicit confirmed_recipient_count of exactly %d to proceed.',
                $resolvedCount,
                $this->maxRecipientsWithoutConfirmation,
                $resolvedCount
            ));
        }
    }

    /**
     * Idempotency claim. Returns true if THIS process is the first to claim
     * (post, connection, recipient) and should perform the send; false if it
     * was already claimed (i.e. a cron re-run) and the send must be skipped.
     */
    public function claim(
        int $postId,
        int $connectionId,
        string $channel,
        string $recipient,
        ?int $siteId = null,
        ?int $segmentId = null
    ): bool {
        $sql = 'INSERT IGNORE INTO send_ledger
                    (post_id, connection_id, channel, recipient, site_id, segment_id, status)
                VALUES (:post_id, :connection_id, :channel, :recipient, :site_id, :segment_id, "sent")';
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':post_id'       => $postId,
            ':connection_id' => $connectionId,
            ':channel'       => $channel,
            ':recipient'     => $recipient,
            ':site_id'       => $siteId,
            ':segment_id'    => $segmentId,
        ]);

        // rowCount() === 1 means the row was inserted (first claim).
        // 0 means the UNIQUE key already had it (already sent) -> skip.
        return $stmt->rowCount() === 1;
    }

    /** Record the final outcome of a claimed send. */
    public function markStatus(int $postId, int $connectionId, string $recipient, string $status): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE send_ledger SET status = :status
             WHERE post_id = :post_id AND connection_id = :connection_id AND recipient = :recipient'
        );
        $stmt->execute([
            ':status'        => $status === 'failed' ? 'failed' : 'sent',
            ':post_id'       => $postId,
            ':connection_id' => $connectionId,
            ':recipient'     => $recipient,
        ]);
    }

    /**
     * ADAPT THIS to your schema. Build notes say recipients live in
     * sms_contacts keyed by site_id + segment_id. Adjust table/column names
     * for other channels if they differ.
     */
    private function segmentHasRecipients(int $siteId, int $segmentId): bool
    {
        $stmt = $this->pdo->prepare(
            'SELECT 1 FROM sms_contacts
             WHERE site_id = :site_id AND segment_id = :segment_id
             LIMIT 1'
        );
        $stmt->execute([':site_id' => $siteId, ':segment_id' => $segmentId]);
        return (bool) $stmt->fetchColumn();
    }
}
