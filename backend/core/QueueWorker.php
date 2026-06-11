<?php
class QueueWorker {
    public static function run(): array {
        $now    = date('Y-m-d H:i:s');
        $worker = substr(gethostname().'-'.getmypid(), 0, 64);

        // 1. Release stale locks
        DB::run("UPDATE publish_queue SET locked_at=NULL, locked_by=NULL
                 WHERE locked_at IS NOT NULL
                 AND locked_at < (NOW() - INTERVAL ".(int)CRON_LOCK_TTL." SECOND)");

        // 2. PERMANENT FIX: auto-remove queue entries for posts already fully done
        DB::run("DELETE pq FROM publish_queue pq
                 JOIN posts p ON p.id = pq.post_id
                 WHERE p.status IN ('published','failed')
                 AND NOT EXISTS (
                     SELECT 1 FROM post_targets pt
                     WHERE pt.post_id = pq.post_id
                     AND pt.status NOT IN ('published','failed','skipped')
                 )");

        // 2.5 STALE GUARD: anything more than QUEUE_MAX_LATE_HOURS overdue reverts to draft
        // so an outage can never cause a burst of days-old content publishing late.
        $lateH = defined('QUEUE_MAX_LATE_HOURS') ? (int)QUEUE_MAX_LATE_HOURS : 12;
        DB::run("UPDATE posts p JOIN publish_queue pq ON pq.post_id = p.id
                 SET p.status='draft'
                 WHERE pq.fire_at < (NOW() - INTERVAL {$lateH} HOUR)
                 AND p.status NOT IN ('published','failed','cancelled','draft')");
        DB::run("DELETE pq FROM publish_queue pq
                 JOIN posts p ON p.id = pq.post_id
                 WHERE p.status='draft'");
        // 3. Claim and process due jobs
        $jobs = DB::all("SELECT * FROM publish_queue
                         WHERE fire_at <= NOW() AND locked_at IS NULL
                         ORDER BY priority ASC, fire_at ASC
                         LIMIT ".(int)QUEUE_BATCH);

        $processed = [];
        foreach ($jobs as $job) {
            $claimed = DB::update('publish_queue',
                ['locked_at'=>$now, 'locked_by'=>$worker],
                'id=? AND locked_at IS NULL', [$job['id']]);
            if ($claimed < 1) continue;

            try {
                self::processPost((int)$job['post_id']);
            } catch (Throwable $e) {
                self::log((int)$job['post_id'], 'worker_error', $e->getMessage());
                $attempts = min(1000000, (int)$job['attempts'] + 1);
                DB::update('publish_queue',
                    ['locked_at'=>null, 'locked_by'=>null,
                     'fire_at'=>date('Y-m-d H:i:s', time()+120),
                     'attempts'=>$attempts],
                    'post_id=?', [$job['post_id']]);
            }
            $processed[] = (int)$job['post_id'];
        }
        return $processed;
    }

    private static function processPost(int $postId): void {
        $post = DB::one("SELECT * FROM posts WHERE id=?", [$postId]);
        if (!$post) {
            DB::run("DELETE FROM publish_queue WHERE post_id=?", [$postId]);
            return;
        }

        DB::update('posts', ['status'=>'publishing'], 'id=?', [$postId]);
        self::skipDisabledTargets($postId);
        $media   = self::resolveMedia($post['media_ids'] ?? null);
        $targets = DB::all("SELECT pt.*, pl.key_name FROM post_targets pt
                            JOIN platforms pl ON pl.id=pt.platform_id
                            WHERE pt.post_id=? AND pt.status IN ('pending','publishing')",
                            [$postId]);

        foreach ($targets as $t) {
            $att = (int)$t['attempts'] + 1;
            DB::update('post_targets',
                ['status'=>'publishing','attempts'=>$att,'last_attempt'=>date('Y-m-d H:i:s')],
                'id=?', [$t['id']]);
            try {
                if (!PublisherFactory::supported($t['key_name']))
                    throw new RuntimeException("Platform '{$t['key_name']}' not connected/supported yet");
                $conn = !empty($t['connection_id'])
                    ? DB::one("SELECT * FROM platform_connections WHERE id=?", [$t['connection_id']])
                    : null;
                $pub = PublisherFactory::for($t['key_name']);
                $res = $pub->publish($conn, $t, $post, $media);
                DB::update('post_targets', [
                    'status'=>'published',
                    'platform_post_id'=>$res['id']??null,
                    'platform_url'=>$res['url']??null,
                    'published_at'=>date('Y-m-d H:i:s'),
                    'error_message'=>null
                ], 'id=?', [$t['id']]);
            } catch (Throwable $e) {
                $status = $att >= (int)MAX_RETRIES ? 'failed' : 'pending';
                DB::update('post_targets',
                    ['status'=>$status, 'error_message'=>substr($e->getMessage(),0,1000)],
                    'id=?', [$t['id']]);
                self::log($postId, 'publish_error', $t['key_name'].': '.$e->getMessage());
            }
        }

        self::finalizePost($postId, $post);
    }

    private static function skipDisabledTargets(int $postId): void {
        DB::run("UPDATE post_targets pt
                 JOIN platforms pl ON pl.id = pt.platform_id
                 SET pt.status='skipped',
                     pt.error_message='SMS delivery is disabled. Use WhatsApp or media.'
                 WHERE pt.post_id=?
                 AND pl.key_name='sms'
                 AND pt.status IN ('pending','publishing')", [$postId]);
    }

    private static function finalizePost(int $postId, array $post): void {
        $cnt = DB::one("SELECT
                          COALESCE(SUM(status='published'),0) AS pub,
                          COALESCE(SUM(status NOT IN ('published','skipped','failed')),0) AS notdone
                        FROM post_targets WHERE post_id=?", [$postId]);

        $notdone = (int)($cnt['notdone'] ?? 0);
        $pub     = (int)($cnt['pub']     ?? 0);

        if ($notdone === 0) {
            $hasPub = $pub > 0;
            DB::update('posts', [
                'status'       => $hasPub ? 'published' : 'failed',
                'published_at' => $hasPub ? date('Y-m-d H:i:s') : null
            ], 'id=?', [$postId]);

            DB::run("DELETE FROM publish_queue WHERE post_id=?", [$postId]);

            $cap = substr($post['caption'] ?? 'Post', 0, 60);
            if ($hasPub) {
                NotificationService::postPublished($postId, $cap, 'social media');
                self::sendFirstComment($postId, $post);
            } else {
                NotificationService::postFailed($postId, $cap, 'One or more platforms failed');
            }
        } else {
            DB::update('posts', ['status'=>'scheduled'], 'id=?', [$postId]);
            DB::update('publish_queue', [
                'locked_at' => null,
                'locked_by' => null,
                'fire_at'   => date('Y-m-d H:i:s', time()+300)
            ], 'post_id=?', [$postId]);
        }
    }

    private static function sendFirstComment(int $postId, array $post): void {
        $firstComment = $post['first_comment'] ?? null;
        if (!$firstComment) return;
        $targets = DB::all(
            "SELECT pt.*, pc.access_token, pc.account_id, pl.key_name
             FROM post_targets pt
             JOIN platform_connections pc ON pc.id=pt.connection_id
             JOIN platforms pl ON pl.id=pt.platform_id
             WHERE pt.post_id=? AND pt.status='published'
             AND pl.key_name IN ('facebook','instagram','instagram_business')",
            [$postId]);
        foreach ($targets as $t) {
            try {
                $tok = Crypto::dec($t['access_token']);
                $ch = curl_init("https://graph.facebook.com/v19.0/{$t['platform_post_id']}/comments");
                curl_setopt_array($ch,[
                    CURLOPT_RETURNTRANSFER=>true,
                    CURLOPT_POST=>true,
                    CURLOPT_POSTFIELDS=>http_build_query(['message'=>$firstComment,'access_token'=>$tok])
                ]);
                curl_exec($ch); curl_close($ch);
            } catch (\Throwable $e) { /* silent */ }
        }
    }

    private static function resolveMedia(?string $json): array {
        $ids = $json ? json_decode($json, true) : [];
        if (!is_array($ids) || !$ids) return [];
        $ph   = implode(',', array_fill(0, count($ids), '?'));
        $rows = DB::all("SELECT id,url,mime_type,alt_text FROM media WHERE id IN ({$ph})", $ids);
        $byId = []; foreach ($rows as $r) $byId[$r['id']] = $r;
        $out  = [];
        foreach ($ids as $id) {
            if (!isset($byId[$id])) continue;
            $r = $byId[$id];
            $mt   = (string)$r['mime_type'];
            $type = str_starts_with($mt,'video') ? 'video' : (str_starts_with($mt,'audio') ? 'audio' : 'image');
            $out[] = ['url'=>$r['url'],"type"=>$type,'alt'=>$r['alt_text']??null,'mime'=>$r['mime_type']];
        }
        return $out;
    }

    private static function log(int $postId, string $event, string $msg): void {
        @file_put_contents(
            STORAGE_PATH.'/logs/queue.log',
            date('c')." [{$event}] post={$postId} {$msg}\n",
            FILE_APPEND
        );
    }
}
