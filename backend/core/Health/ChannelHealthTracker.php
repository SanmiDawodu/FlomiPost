<?php
/**
 * ChannelHealthTracker — per-channel connection health logging and dashboard.
 *
 * WHY THIS EXISTS
 * ---------------
 * When a channel API credential expires or rate-limits the site, posts fail
 * silently and the operator has no visibility until they notice posts aren't
 * going out. This tracker gives the dashboard a live read on which connections
 * are healthy, which are erroring, and how long ago each was last checked.
 *
 * SCHEMA ASSUMPTION
 * -----------------
 * CREATE TABLE channel_health_log (
 *   id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 *   site_id       INT UNSIGNED NOT NULL,
 *   connection_id INT UNSIGNED NOT NULL,
 *   channel       VARCHAR(64)  NOT NULL,
 *   status        ENUM('ok','error') NOT NULL DEFAULT 'ok',
 *   last_error    TEXT,
 *   checked_at    DATETIME NOT NULL DEFAULT NOW(),
 *   UNIQUE KEY uq_connection (site_id, connection_id)
 * );
 *
 * INTEGRATION
 * -----------
 * Call in each publisher immediately after the channel API call resolves:
 *
 *     require_once __DIR__ . '/../Health/ChannelHealthTracker.php';
 *     $health = new ChannelHealthTracker($pdo);
 *
 *     if ($apiSuccess) {
 *         $health->recordSuccess($post['site_id'], $connectionId, 'whatsapp');
 *     } else {
 *         $health->recordFailure($post['site_id'], $connectionId, 'whatsapp', $apiError);
 *     }
 *
 * Wire getDashboard() into GET /api/health/channels:
 *
 *     $data = $health->getDashboard((int) $_GET['site_id']);
 *     echo json_encode($data);
 */

declare(strict_types=1);

final class ChannelHealthTracker
{
    public function __construct(private \PDO $pdo) {}

    /**
     * Upsert a healthy status for the given connection.
     * ON DUPLICATE KEY UPDATE avoids a separate SELECT + INSERT round-trip.
     */
    public function recordSuccess(int $siteId, int $connectionId, string $channel): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO channel_health_log (site_id, connection_id, channel, status, last_error, checked_at)
             VALUES (:site_id, :connection_id, :channel, \'ok\', NULL, NOW())
             ON DUPLICATE KEY UPDATE
                 status     = \'ok\',
                 last_error = NULL,
                 checked_at = NOW()'
        );
        $stmt->execute([
            ':site_id'       => $siteId,
            ':connection_id' => $connectionId,
            ':channel'       => $channel,
        ]);
    }

    /**
     * Upsert an error status. The last_error text is shown verbatim in the
     * dashboard so include the API response message, not just an error code.
     */
    public function recordFailure(int $siteId, int $connectionId, string $channel, string $error): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO channel_health_log (site_id, connection_id, channel, status, last_error, checked_at)
             VALUES (:site_id, :connection_id, :channel, \'error\', :error, NOW())
             ON DUPLICATE KEY UPDATE
                 status     = \'error\',
                 last_error = :error,
                 checked_at = NOW()'
        );
        $stmt->execute([
            ':site_id'       => $siteId,
            ':connection_id' => $connectionId,
            ':channel'       => $channel,
            ':error'         => $error,
        ]);
    }

    /**
     * Raw status rows for $siteId, ordered so the caller gets a stable list.
     * Suitable for internal use or detailed admin views.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getStatus(int $siteId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM channel_health_log
             WHERE site_id = :site_id
             ORDER BY channel, connection_id'
        );
        $stmt->execute([':site_id' => $siteId]);
        return $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }

    /**
     * Dashboard-ready view keyed by connection_id with a computed age_minutes
     * field so the UI can show "last checked 4 minutes ago" without a second
     * query. Uses PHP time diff rather than TIMESTAMPDIFF so the result is
     * independent of the MySQL server's timezone setting.
     *
     * @return array<int, array<string, mixed>>   keyed by connection_id
     */
    public function getDashboard(int $siteId): array
    {
        $rows   = $this->getStatus($siteId);
        $now    = time();
        $result = [];

        foreach ($rows as $row) {
            // checked_at comes back as a string from PDO; strtotime handles the
            // standard MySQL DATETIME format 'YYYY-MM-DD HH:MM:SS'.
            $checkedTs = strtotime((string) ($row['checked_at'] ?? '')) ?: $now;
            $row['age_minutes'] = (int) round(($now - $checkedTs) / 60);

            $result[(int) $row['connection_id']] = $row;
        }

        return $result;
    }
}
