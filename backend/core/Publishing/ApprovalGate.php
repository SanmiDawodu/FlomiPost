<?php
/**
 * ApprovalGate — editorial approval guard for outbound posts.
 *
 * WHY THIS EXISTS
 * ---------------
 * Publishing directly from 'draft' status was a recurring cause of accidental
 * sends — half-written posts, placeholder copy, or test posts reaching real
 * audiences. The approval gate enforces a deliberate sign-off step before any
 * publisher is allowed to send.
 *
 * The flow is: draft -> pending (via requestApproval) -> approved or rejected
 * (via approve/reject). Only 'approved' posts may pass through to a publisher.
 *
 * INTEGRATION
 * -----------
 * In each publisher, call BEFORE $guard->assertTargeted($post):
 *
 *     require_once __DIR__ . '/../Publishing/ApprovalGate.php';
 *     $gate = new ApprovalGate($pdo);
 *     $gate->assertApproved($post);   // throws if not approved
 *     $guard->assertTargeted($post);  // RecipientGuard runs second
 *
 * This ordering matters: no point checking recipients for a post that hasn't
 * been approved yet. The approval check is cheaper and fails earlier.
 */

declare(strict_types=1);

final class ApprovalGate
{
    public function __construct(private \PDO $pdo) {}

    /**
     * Hard gate. Throws if the post is not in 'approved' state.
     * Call this at the top of every publisher before doing any real work.
     */
    public function assertApproved(array $post): void
    {
        $status = $post['approval_status'] ?? 'unknown';

        if ($status !== 'approved') {
            throw new \RuntimeException(sprintf(
                'ApprovalGate: post %s has status \'%s\' — only approved posts may be published. '
                . 'Get it approved in the scheduler UI first.',
                (string) ($post['id'] ?? '?'),
                $status
            ));
        }
    }

    /**
     * Moves a draft post into the review queue.
     * Only transitions from 'draft' so re-submitting an already-pending or
     * approved post is a no-op (no accidental rollback of an approval).
     */
    public function requestApproval(int $postId, int $requestedBy): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE posts
             SET approval_status = \'pending\', approval_requested_by = :requested_by
             WHERE id = :id AND approval_status = \'draft\''
        );
        $stmt->execute([
            ':id'           => $postId,
            ':requested_by' => $requestedBy,
        ]);
    }

    /**
     * Records an explicit approval decision with an optional reviewer note.
     * approved_at is stamped server-side so it can't be faked by the caller.
     */
    public function approve(int $postId, int $approvedBy, string $note = ''): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE posts
             SET approval_status = \'approved\',
                 approved_by     = :approved_by,
                 approved_at     = NOW(),
                 approval_note   = :note
             WHERE id = :id'
        );
        $stmt->execute([
            ':id'          => $postId,
            ':approved_by' => $approvedBy,
            ':note'        => $note,
        ]);
    }

    /**
     * Records a rejection. Rejected posts must cycle back through draft ->
     * pending before they can be approved; the publisher will refuse them.
     */
    public function reject(int $postId, int $rejectedBy, string $note = ''): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE posts
             SET approval_status = \'rejected\',
                 approved_by     = :rejected_by,
                 approved_at     = NOW(),
                 approval_note   = :note
             WHERE id = :id'
        );
        $stmt->execute([
            ':id'          => $postId,
            ':rejected_by' => $rejectedBy,
            ':note'        => $note,
        ]);
    }
}
