<?php
// Inbox sync — run every 15 minutes via cron
// */15 * * * * php /var/www/flowpost/backend/cron/process_inbox.php
require_once __DIR__.'/../load_env.php';
require_once __DIR__.'/../config.php';
require_once __DIR__.'/../core/DB.php';
require_once __DIR__.'/../core/Crypto.php';
require_once __DIR__.'/../core/InboxFetcher.php';
try {
    $results = InboxFetcher::fetchAll();
    if (!empty($results)) {
        $newCount = array_sum(array_map(fn($row) => (int)($row['new'] ?? 0), $results));
        echo date('Y-m-d H:i:s') . " Inbox sync: {$newCount} new messages\n";
    }
} catch (\Throwable $e) {
    echo date('Y-m-d H:i:s') . ' Inbox ERROR: ' . $e->getMessage() . "\n";
}
