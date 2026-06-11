<?php
// Insights fetcher — run every hour via cron
// 0 * * * * php /var/www/flowpost/backend/cron/process_insights.php
require_once __DIR__.'/../load_env.php';
require_once __DIR__.'/../config.php';
require_once __DIR__.'/../core/DB.php';
require_once __DIR__.'/../core/Crypto.php';
require_once __DIR__.'/../core/InsightsFetcher.php';
try {
    InsightsFetcher::fetchRecent();
    echo date('Y-m-d H:i:s') . " Insights fetch complete\n";
} catch (\Throwable $e) {
    echo date('Y-m-d H:i:s') . ' Insights ERROR: ' . $e->getMessage() . "\n";
}
