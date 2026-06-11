<?php
/**
 * BulkImporter — batch-import scheduled posts from a CSV file.
 *
 * WHY THIS EXISTS
 * ---------------
 * Content teams plan campaigns in spreadsheets. Manually entering 50–200 posts
 * one-by-one through the scheduler UI is slow and error-prone. BulkImporter
 * accepts a CSV, validates every row in isolation (bad rows are skipped with a
 * collected error report, not an abort), and inserts clean rows as 'draft' posts
 * so they still go through the normal approval → publish workflow.
 *
 * All imported posts land in approval_status = 'draft'. No post reaches an
 * audience without going through ApprovalGate first — that is intentional and
 * must not be changed here.
 *
 * INTEGRATION
 * -----------
 * Expose as POST /api/posts/bulk-import, accept multipart/form-data with a
 * file field named 'csv'. Typical controller wiring:
 *
 *     $importer = new BulkImporter($pdo);
 *     $result = $importer->importCsv($_FILES['csv']['tmp_name'], $siteId, $userId);
 *     // $result = ['imported' => int, 'errors' => [['row' => int, 'message' => string], ...]]
 *
 * Move or copy the upload to a safe temp path before calling importCsv if your
 * framework doesn't guarantee the tmp file is readable at point-of-use.
 *
 * CSV FORMAT
 * ----------
 * First row must be a header (case-insensitive). Required columns:
 *   channel        — one of: facebook instagram whatsapp telegram linkedin
 *                            youtube tiktok twitter
 *   content        — non-empty post body
 *   scheduled_at   — ISO 8601 or Y-m-d H:i:s, must be in the future
 *
 * Optional columns:
 *   segment_id     — integer; foreign key into contact_segments; omit or leave
 *                    blank to leave NULL (post will be blocked by RecipientGuard
 *                    unless segment_id is set before approval)
 *
 * LIMITS
 * ------
 * Max 500 data rows per file. Exceeding this throws a RuntimeException before
 * any rows are inserted. This prevents accidental multi-thousand row imports
 * from a mis-exported sheet.
 */

declare(strict_types=1);

final class BulkImporter
{
    private const MAX_ROWS = 500;

    private const VALID_CHANNELS = [
        'facebook', 'instagram', 'whatsapp', 'telegram',
        'linkedin', 'youtube', 'tiktok', 'twitter',
    ];

    public function __construct(private \PDO $pdo) {}

    /**
     * Parse, validate, and insert posts from a CSV file.
     *
     * @param  string $csvPath   Absolute path to the CSV file (tmp upload or real path).
     * @param  int    $siteId    The site that owns these posts.
     * @param  int    $createdBy users.id of the person doing the import.
     * @return array{imported: int, errors: list<array{row: int, message: string}>}
     *
     * @throws \RuntimeException if the file cannot be opened or row count exceeds MAX_ROWS.
     */
    public function importCsv(string $csvPath, int $siteId, int $createdBy): array
    {
        $handle = @fopen($csvPath, 'r');
        if ($handle === false) {
            throw new \RuntimeException(
                sprintf('BulkImporter: cannot open CSV file at path "%s".', $csvPath)
            );
        }

        try {
            return $this->process($handle, $siteId, $createdBy);
        } finally {
            fclose($handle);
        }
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /** @param resource $handle */
    private function process($handle, int $siteId, int $createdBy): array
    {
        // Read header row and normalise to lowercase keys.
        $rawHeader = fgetcsv($handle);
        if ($rawHeader === false || $rawHeader === null) {
            throw new \RuntimeException('BulkImporter: CSV file is empty or unreadable.');
        }

        $header = array_map('strtolower', array_map('trim', $rawHeader));
        $this->assertRequiredColumns($header);

        $colIndex = array_flip($header);

        // Slurp all data rows so we can enforce the row cap before touching the DB.
        $rows = [];
        while (($row = fgetcsv($handle)) !== false) {
            // Skip completely blank lines (fgetcsv returns [null] for empty lines).
            if ($row === [null]) {
                continue;
            }
            $rows[] = $row;
        }

        if (count($rows) > self::MAX_ROWS) {
            throw new \RuntimeException(sprintf(
                'BulkImporter: CSV contains %d data rows which exceeds the maximum of %d. '
                . 'Split the file and re-import.',
                count($rows),
                self::MAX_ROWS
            ));
        }

        $imported = 0;
        $errors   = [];

        $stmt = $this->prepareInsert();

        foreach ($rows as $i => $row) {
            $lineNumber = $i + 2; // 1-based, accounting for the header row.

            $error = $this->validateAndInsert($stmt, $row, $colIndex, $siteId, $createdBy);
            if ($error !== null) {
                $errors[] = ['row' => $lineNumber, 'message' => $error];
            } else {
                $imported++;
            }
        }

        return ['imported' => $imported, 'errors' => $errors];
    }

    /** @param array<int, string> $header */
    private function assertRequiredColumns(array $header): void
    {
        $required = ['channel', 'content', 'scheduled_at'];
        $missing  = array_diff($required, $header);

        if (!empty($missing)) {
            throw new \RuntimeException(sprintf(
                'BulkImporter: CSV is missing required column(s): %s.',
                implode(', ', $missing)
            ));
        }
    }

    private function prepareInsert(): \PDOStatement
    {
        return $this->pdo->prepare(
            'INSERT INTO posts
                 (site_id, channel, content, scheduled_at, segment_id,
                  approval_status, created_by, created_at)
             VALUES
                 (:site_id, :channel, :content, :scheduled_at, :segment_id,
                  \'draft\', :created_by, NOW())'
        );
    }

    /**
     * Validate a single row and, if valid, execute the prepared INSERT.
     * Returns null on success or an error message string on failure.
     *
     * @param  array<int, string>  $row
     * @param  array<string, int>  $colIndex
     */
    private function validateAndInsert(
        \PDOStatement $stmt,
        array $row,
        array $colIndex,
        int $siteId,
        int $createdBy
    ): ?string {
        $get = static function (string $col) use ($row, $colIndex): string {
            return isset($colIndex[$col]) ? trim((string) ($row[$colIndex[$col]] ?? '')) : '';
        };

        // --- channel ---
        $channel = strtolower($get('channel'));
        if (!in_array($channel, self::VALID_CHANNELS, true)) {
            return sprintf(
                'Invalid channel "%s". Allowed: %s.',
                $channel,
                implode(', ', self::VALID_CHANNELS)
            );
        }

        // --- content ---
        $content = $get('content');
        if ($content === '') {
            return 'Content is empty.';
        }

        // --- scheduled_at ---
        $rawDate = $get('scheduled_at');
        $scheduledAt = $this->parseDate($rawDate);
        if ($scheduledAt === null) {
            return sprintf('scheduled_at "%s" is not a valid date/time.', $rawDate);
        }
        if ($scheduledAt->getTimestamp() <= time()) {
            return sprintf('scheduled_at "%s" must be in the future.', $rawDate);
        }

        // --- segment_id (optional) ---
        $rawSegment = $get('segment_id');
        $segmentId  = ($rawSegment !== '' && ctype_digit($rawSegment))
            ? (int) $rawSegment
            : null;

        $stmt->execute([
            ':site_id'      => $siteId,
            ':channel'      => $channel,
            ':content'      => $content,
            ':scheduled_at' => $scheduledAt->format('Y-m-d H:i:s'),
            ':segment_id'   => $segmentId,
            ':created_by'   => $createdBy,
        ]);

        return null;
    }

    /**
     * Try to parse the date string as ISO 8601 or Y-m-d H:i:s.
     * Returns a DateTimeImmutable on success, null if unparseable.
     */
    private function parseDate(string $value): ?\DateTimeImmutable
    {
        if ($value === '') {
            return null;
        }

        // DateTimeImmutable constructor is permissive; use createFromFormat for
        // the two formats we explicitly support, then fall back to the constructor
        // for ISO 8601 variants (e.g. 2026-06-11T14:00:00Z, +offset, etc.).
        $formats = ['Y-m-d H:i:s', 'Y-m-d\TH:i:s', 'Y-m-d\TH:i:sP', 'Y-m-d\TH:i:s\Z'];

        foreach ($formats as $fmt) {
            $dt = \DateTimeImmutable::createFromFormat($fmt, $value);
            if ($dt !== false) {
                return $dt;
            }
        }

        // Last resort: let PHP's parser try (handles UTC Z suffix and offsets
        // that don't match the explicit formats above).
        try {
            return new \DateTimeImmutable($value);
        } catch (\Exception) {
            return null;
        }
    }
}
