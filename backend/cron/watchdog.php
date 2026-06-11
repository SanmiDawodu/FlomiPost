<?php
// FlomiPost watchdog — run every 5 min. Restarts MariaDB if down; alerts on dead queue/backlog.
require_once __DIR__.'/../load_env.php';
require_once __DIR__.'/../config.php';
if (file_exists(__DIR__.'/../vendor/autoload.php')) require_once __DIR__.'/../vendor/autoload.php';

function env_any(array $names): ?string {
    foreach ($names as $n) {
        $v = getenv($n); if ($v !== false && $v !== '') return $v;
        if (isset($_ENV[$n]) && $_ENV[$n] !== '') return $_ENV[$n];
        if (defined($n) && constant($n) !== '') return (string)constant($n);
    }
    return null;
}

$alerts = [];

// --- MariaDB up? Restart if not. ---
exec('systemctl is-active mariadb 2>/dev/null', $o1, $rc1);
$active = trim(implode('', $o1)) === 'active';
if (!$active) {
    exec('systemctl restart mariadb 2>&1', $o2);
    sleep(3);
    exec('systemctl is-active mariadb 2>/dev/null', $o3);
    $now = trim(implode('', $o3)) === 'active' ? 'restarted OK' : 'RESTART FAILED';
    $alerts[] = "MariaDB was DOWN — $now";
}

// --- Queue worker heartbeat fresh? ---
$hb = STORAGE_PATH.'/logs/queue.heartbeat';
if (!file_exists($hb) || time() - filemtime($hb) > 600) {
    $alerts[] = 'Queue worker heartbeat stale >10min (cron dead or disabled?)';
}

// --- Backlog piling up? (only if DB reachable) ---
try {
    require_once __DIR__.'/../core/DB.php';
    $r = DB::one("SELECT COUNT(*) c FROM publish_queue WHERE fire_at < (NOW() - INTERVAL 30 MINUTE) AND locked_at IS NULL");
    if ((int)($r['c'] ?? 0) > 10) $alerts[] = "Queue backlog: {$r['c']} jobs >30min overdue";
} catch (Throwable $e) {
    $alerts[] = 'DB unreachable from watchdog: '.substr($e->getMessage(), 0, 120);
}

if (!$alerts) exit(0);

$msg = '[FlomiPost] '.implode(' | ', $alerts);
@file_put_contents(STORAGE_PATH.'/logs/watchdog.log', date('c').' '.$msg."\n", FILE_APPEND);

// Rate-limit alerts to one per hour
$state = STORAGE_PATH.'/logs/watchdog.last_alert';
if (file_exists($state) && time() - filemtime($state) < 3600) exit(0);

$to = env_any(['WATCHDOG_ALERT_EMAIL','FLOWPOST_ALERT_EMAIL','ADMIN_EMAIL','SMTP_USER']);
if ($to) {
    try {
        require_once __DIR__.'/../core/DB.php';
        require_once __DIR__.'/../core/EmailService.php';
        $sent = EmailService::send(
            $to,
            'FlowPost Admin',
            'FlowPost Watchdog Alert',
            '<p>'.htmlspecialchars($msg, ENT_QUOTES, 'UTF-8').'</p>',
            $msg
        );
        if ($sent) {
            @touch($state);
        } else {
            @file_put_contents(STORAGE_PATH.'/logs/watchdog.log', date('c')." email alert failed\n", FILE_APPEND);
        }
    } catch (Throwable $e) {
        @file_put_contents(STORAGE_PATH.'/logs/watchdog.log', date('c').' email alert error: '.substr($e->getMessage(), 0, 160)."\n", FILE_APPEND);
    }
} else {
    @file_put_contents(STORAGE_PATH.'/logs/watchdog.log', date('c')." (no watchdog email configured - log-only alert)\n", FILE_APPEND);
}
