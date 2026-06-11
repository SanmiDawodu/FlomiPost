<?php
/**
 * SegmentBuilder — create and resolve dynamic contact segments.
 *
 * WHY THIS EXISTS
 * ---------------
 * Hard-coding contact lists in post records doesn't scale and makes retargeting
 * impossible. A segment is a named, reusable filter rule stored as JSON. At send
 * time the publisher resolves the segment to a live recipient list so new
 * contacts added after segment creation are automatically included.
 *
 * Segments are the prerequisite for RecipientGuard::assertTargeted() — every
 * post must reference a segment_id, and that segment must resolve to at least
 * one recipient before the send queue picks up the post.
 *
 * DATABASE SCHEMA (see migration 2026_06_contact_segments.sql)
 * ------------------------------------------------------------
 *   CREATE TABLE IF NOT EXISTS contact_segments (
 *       id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 *       site_id    BIGINT UNSIGNED NOT NULL,
 *       name       VARCHAR(255)    NOT NULL,
 *       filters    JSON            NOT NULL,   -- array of {field, op, value} objects
 *       created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
 *       PRIMARY KEY (id),
 *       KEY idx_site (site_id)
 *   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
 *
 * FILTER SPEC
 * -----------
 * $filters is an array of condition objects, each with:
 *   'field'  — one of: tag | city | country | created_after | created_before | channel
 *   'op'     — one of: eq | neq | contains | gt | lt
 *   'value'  — scalar (string or number)
 *
 * All conditions are ANDed together.
 *
 *   'channel' field — filters contacts by their preferred channel.
 *                     Allowed values: whatsapp | telegram
 *   'tag'     field — matches the tags column (expects LIKE-compatible contains).
 *   'city' / 'country' — direct VARCHAR equality / contains.
 *   'created_after' / 'created_before' — compare against contacts.created_at.
 *
 * Example:
 *   $filters = [
 *       ['field' => 'country', 'op' => 'eq',       'value' => 'NG'],
 *       ['field' => 'channel', 'op' => 'eq',       'value' => 'whatsapp'],
 *       ['field' => 'created_after', 'op' => 'gt', 'value' => '2026-01-01'],
 *   ];
 *
 * INTEGRATION
 * -----------
 * POST /api/segments
 *     Body: { "name": "...", "filters": [...] }
 *     Returns: { "segment_id": 42 }
 *
 * GET /api/segments/{id}/count
 *     Returns: { "count": 1234 }
 *
 * The resolve() method is called internally by publishers; it is not exposed as
 * a public API endpoint (the recipient list can be large and is PII-sensitive).
 */

declare(strict_types=1);

final class SegmentBuilder
{
    /** Columns in sms_contacts that filters may target. */
    private const ALLOWED_FIELDS = [
        'tag', 'city', 'country', 'created_after', 'created_before', 'channel',
    ];

    /** Comparison operators supported by the filter engine. */
    private const ALLOWED_OPS = ['eq', 'neq', 'contains', 'gt', 'lt'];

    /** Channels a contact may prefer; used when filtering on 'channel'. */
    private const ALLOWED_CHANNEL_VALUES = ['whatsapp', 'telegram'];

    public function __construct(private \PDO $pdo) {}

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Persist a new segment and return its id.
     *
     * @param  int    $siteId  Site that owns this segment.
     * @param  string $name    Human-readable label shown in the UI.
     * @param  list<array{field: string, op: string, value: mixed}> $filters
     * @return int  The new segment_id.
     *
     * @throws \InvalidArgumentException if any filter is structurally invalid.
     */
    public function create(int $siteId, string $name, array $filters): int
    {
        $this->validateFilters($filters);

        $stmt = $this->pdo->prepare(
            'INSERT INTO contact_segments (site_id, name, filters, created_at)
             VALUES (:site_id, :name, :filters, NOW())'
        );
        $stmt->execute([
            ':site_id' => $siteId,
            ':name'    => $name,
            ':filters' => json_encode($filters, JSON_THROW_ON_ERROR),
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    /**
     * Resolve a segment to a concrete list of recipient identifiers.
     *
     * @return list<array{recipient: string, channel: string}>
     *
     * @throws \RuntimeException if the segment does not exist for this site.
     */
    public function resolve(int $siteId, int $segmentId): array
    {
        $filters = $this->loadFilters($siteId, $segmentId);
        [$whereClause, $params] = $this->buildWhere($siteId, $filters);

        $sql = "SELECT recipient, channel
                FROM sms_contacts
                WHERE {$whereClause}";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Return the count of matching contacts without fetching their data.
     *
     * @throws \RuntimeException if the segment does not exist for this site.
     */
    public function count(int $siteId, int $segmentId): int
    {
        $filters = $this->loadFilters($siteId, $segmentId);
        [$whereClause, $params] = $this->buildWhere($siteId, $filters);

        $sql = "SELECT COUNT(*) FROM sms_contacts WHERE {$whereClause}";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        return (int) $stmt->fetchColumn();
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Load and decode the filter JSON for a segment, asserting site ownership.
     *
     * @return list<array{field: string, op: string, value: mixed}>
     */
    private function loadFilters(int $siteId, int $segmentId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT filters FROM contact_segments
             WHERE id = :id AND site_id = :site_id
             LIMIT 1'
        );
        $stmt->execute([':id' => $segmentId, ':site_id' => $siteId]);

        $row = $stmt->fetch(\PDO::FETCH_ASSOC);
        if ($row === false) {
            throw new \RuntimeException(sprintf(
                'SegmentBuilder: segment %d not found for site %d.',
                $segmentId,
                $siteId
            ));
        }

        return json_decode((string) $row['filters'], true, 512, JSON_THROW_ON_ERROR);
    }

    /**
     * Build a parameterized WHERE clause from a filter list + a mandatory
     * site_id condition. Filter values are NEVER interpolated into SQL — they
     * are always bound via PDO named parameters.
     *
     * @param  list<array{field: string, op: string, value: mixed}> $filters
     * @return array{0: string, 1: array<string, mixed>}  [whereClause, params]
     */
    private function buildWhere(int $siteId, array $filters): array
    {
        // The site_id condition is always the first, mandatory predicate.
        $conditions = ['site_id = :_site_id'];
        $params      = [':_site_id' => $siteId];

        foreach ($filters as $idx => $filter) {
            $field = $filter['field'];
            $op    = $filter['op'];
            $value = $filter['value'];

            $paramKey = ':filter_' . $idx;

            // Map logical field names to actual column names in sms_contacts.
            $column = match ($field) {
                'tag'            => 'tags',
                'city'           => 'city',
                'country'        => 'country',
                'created_after'  => 'created_at',
                'created_before' => 'created_at',
                'channel'        => 'channel',
            };

            switch ($op) {
                case 'eq':
                    $conditions[] = "{$column} = {$paramKey}";
                    $params[$paramKey] = $value;
                    break;

                case 'neq':
                    $conditions[] = "{$column} != {$paramKey}";
                    $params[$paramKey] = $value;
                    break;

                case 'contains':
                    $conditions[] = "{$column} LIKE {$paramKey}";
                    // Escape existing LIKE wildcards in the value so the user
                    // string is treated as a literal substring, not a pattern.
                    $params[$paramKey] = '%' . str_replace(['%', '_'], ['\\%', '\\_'], (string) $value) . '%';
                    break;

                case 'gt':
                    $conditions[] = "{$column} > {$paramKey}";
                    $params[$paramKey] = $value;
                    break;

                case 'lt':
                    $conditions[] = "{$column} < {$paramKey}";
                    $params[$paramKey] = $value;
                    break;
            }
        }

        return [implode(' AND ', $conditions), $params];
    }

    /**
     * Validate filter structure before persisting. Throws on first bad filter
     * rather than silently dropping it — better to fail loudly at create time
     * than silently under-filter a blast at send time.
     *
     * @param list<array{field: string, op: string, value: mixed}> $filters
     */
    private function validateFilters(array $filters): void
    {
        foreach ($filters as $i => $filter) {
            if (!isset($filter['field'], $filter['op'], $filter['value'])) {
                throw new \InvalidArgumentException(sprintf(
                    'SegmentBuilder: filter[%d] must have field, op, and value keys.',
                    $i
                ));
            }

            if (!in_array($filter['field'], self::ALLOWED_FIELDS, true)) {
                throw new \InvalidArgumentException(sprintf(
                    'SegmentBuilder: filter[%d] field "%s" is not allowed. Allowed: %s.',
                    $i,
                    $filter['field'],
                    implode(', ', self::ALLOWED_FIELDS)
                ));
            }

            if (!in_array($filter['op'], self::ALLOWED_OPS, true)) {
                throw new \InvalidArgumentException(sprintf(
                    'SegmentBuilder: filter[%d] op "%s" is not allowed. Allowed: %s.',
                    $i,
                    $filter['op'],
                    implode(', ', self::ALLOWED_OPS)
                ));
            }

            if ($filter['field'] === 'channel'
                && !in_array($filter['value'], self::ALLOWED_CHANNEL_VALUES, true)
            ) {
                throw new \InvalidArgumentException(sprintf(
                    'SegmentBuilder: filter[%d] channel value "%s" is not allowed. '
                    . 'Allowed: %s.',
                    $i,
                    (string) $filter['value'],
                    implode(', ', self::ALLOWED_CHANNEL_VALUES)
                ));
            }
        }
    }
}
