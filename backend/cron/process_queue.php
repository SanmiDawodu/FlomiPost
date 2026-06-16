<?php
// Entry point invoked by cron every minute.
set_time_limit(90);
require_once __DIR__.'/../load_env.php';
require_once __DIR__.'/../config.php';
require_once __DIR__.'/../core/DB.php';
require_once __DIR__.'/../core/Crypto.php';
require_once __DIR__.'/../core/Publishers/Publisher.php';
require_once __DIR__.'/../core/Publishers/AbstractPublisher.php';
require_once __DIR__.'/../core/Publishers/DummyPublisher.php';
require_once __DIR__.'/../core/Publishers/TelegramPublisher.php';
require_once __DIR__.'/../core/Publishers/DiscordPublisher.php';
require_once __DIR__.'/../core/Publishers/FacebookPublisher.php';
require_once __DIR__.'/../core/Publishers/InstagramPublisher.php';
require_once __DIR__.'/../core/Publishers/PinterestPublisher.php';
require_once __DIR__.'/../core/Publishers/RedditPublisher.php';
require_once __DIR__.'/../core/Publishers/WhatsAppPublisher.php';
require_once __DIR__.'/../core/Publishers/TwitterPublisher.php';
require_once __DIR__.'/../core/Publishers/LinkedInPublisher.php';
require_once __DIR__.'/../core/Publishers/LinkedInPagePublisher.php';
require_once __DIR__.'/../core/Publishers/YouTubePublisher.php';
require_once __DIR__.'/../core/Publishers/TikTokPublisher.php';
require_once __DIR__.'/../core/GoogleBusinessOAuth.php';
require_once __DIR__.'/../core/Publishers/GoogleBusinessPublisher.php';
require_once __DIR__.'/../core/NotificationService.php';
require_once __DIR__.'/../core/PublisherFactory.php';
require_once __DIR__.'/../core/QueueWorker.php';
@mkdir(STORAGE_PATH.'/logs', 0775, true);
@touch(STORAGE_PATH.'/logs/queue.heartbeat');
try {
    $done = QueueWorker::run();
    if ($done) echo date('c')." processed: ".implode(',', $done)."\n";
} catch (Throwable $e) {
    fwrite(STDERR, date('c')." FATAL: ".$e->getMessage()."\n");
    exit(1);
}
