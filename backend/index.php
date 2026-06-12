<?php
error_reporting(0);
ini_set("display_errors", "0");
require_once __DIR__.'/load_env.php';
if (file_exists(__DIR__.'/vendor/autoload.php')) require_once __DIR__.'/vendor/autoload.php';
require_once __DIR__.'/config.php';
require_once __DIR__.'/core/DB.php';
require_once __DIR__.'/core/Router.php';
require_once __DIR__.'/core/AIService.php';
require_once __DIR__.'/middleware/Auth.php';
require_once __DIR__.'/models/PostModel.php';
require_once __DIR__.'/core/Crypto.php';
require_once __DIR__.'/core/Publishers/Publisher.php';
require_once __DIR__.'/core/Publishers/AbstractPublisher.php';
require_once __DIR__.'/core/Publishers/TelegramPublisher.php';
require_once __DIR__.'/core/Publishers/DiscordPublisher.php';
require_once __DIR__.'/core/Publishers/FacebookPublisher.php';
require_once __DIR__.'/core/Publishers/InstagramPublisher.php';
require_once __DIR__.'/core/Publishers/DummyPublisher.php';
require_once __DIR__.'/core/PublisherFactory.php';
require_once __DIR__.'/core/QueueWorker.php';
require_once __DIR__.'/core/MetaOAuth.php';
require_once __DIR__.'/core/RSSWorker.php';
require_once __DIR__.'/core/PinterestOAuth.php';
require_once __DIR__.'/core/RedditOAuth.php';
require_once __DIR__.'/core/Publishers/PinterestPublisher.php';
require_once __DIR__.'/core/Publishers/RedditPublisher.php';
require_once __DIR__.'/core/Publishers/WhatsAppPublisher.php';
require_once __DIR__.'/core/Publishers/TwitterPublisher.php';
require_once __DIR__.'/core/Publishers/LinkedInPublisher.php';
require_once __DIR__.'/core/Publishers/YouTubePublisher.php';
require_once __DIR__.'/core/Publishers/TikTokPublisher.php';
require_once __DIR__.'/core/LinkedInOAuth.php';
require_once __DIR__.'/core/TikTokOAuth.php';
require_once __DIR__.'/core/YouTubeOAuth.php';
require_once __DIR__.'/core/TwitterOAuth.php';
require_once __DIR__.'/core/LinkedInOAuth.php';
require_once __DIR__.'/core/GAOAuth.php';
require_once __DIR__.'/core/CanvaOAuth.php';
require_once __DIR__.'/core/NotificationService.php';
require_once __DIR__.'/core/EmailService.php';
require_once __DIR__.'/core/InboxFetcher.php';
require_once __DIR__.'/core/InsightsFetcher.php';
require_once __DIR__.'/core/AI/CaptionGenerator.php';
require_once __DIR__.'/core/Publishing/ApprovalGate.php';
require_once __DIR__.'/core/Webhooks/WebhookDispatcher.php';
require_once __DIR__.'/core/Auth/TOTPAuthenticator.php';
require_once __DIR__.'/core/Health/ChannelHealthTracker.php';
require_once __DIR__.'/core/Scheduling/BulkImporter.php';
require_once __DIR__.'/core/Contacts/SegmentBuilder.php';

$origin=$_SERVER['HTTP_ORIGIN']??'';
$allowed=[APP_URL,'http://localhost:5173','http://localhost:3000'];
if(in_array($origin,$allowed)){
    header("Access-Control-Allow-Origin: {$origin}");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type,Authorization');
}
if($_SERVER['REQUEST_METHOD']==='OPTIONS'){http_response_code(204);exit;}

$router=new Router();

// AUTH
$router->post('/auth/login',function(){
    $b=body();required($b,['email','password']);
    $r=Auth::attempt($b['email'],$b['password']);
    if(!$r) Response::json(['error'=>'Invalid credentials'],401);
    Response::ok($r,'Logged in');
});
$router->post('/auth/logout',function(){ Auth::logout();Response::ok(null,'Logged out'); });
$router->get('/auth/me',function(){ Response::ok(Auth::require()); });

// POSTS
$router->get('/posts',function(){
    $r=PostModel::list(['site_id'=>param('site_id'),'status'=>param('status'),'search'=>param('q'),'page'=>param('page',1),'per_page'=>param('per_page',20)]);
    Response::paginate($r['items'],$r['total'],$r['page'],$r['perPage']);
});
$router->post('/posts',function(){ $id=PostModel::create(body());Response::ok(['id'=>$id],'Post created'); });
$router->get('/calendar', function() {
    Auth::require();
    $from = param('from');
    $to   = param('to');
    $site = param('site_id');
    $excl = implode(',', array_map(function($s){ return '"'.$s.'"'; }, ['draft','cancelled']));
    $where = ["p.status NOT IN ($excl)"];
    $params = [];
    if ($from) { $where[] = 'DATE(p.scheduled_at) >= ?'; $params[] = $from; }
    if ($to)   { $where[] = 'DATE(p.scheduled_at) <= ?'; $params[] = $to; }
    if ($site) { $where[] = 'p.site_id = ?'; $params[] = (int)$site; }
    $w = implode(' AND ', $where);
    $sql = "SELECT p.id, p.site_id, p.caption, p.status, p.scheduled_at, p.media_ids, p.link_url, s.name as site_name FROM posts p JOIN sites s ON s.id = p.site_id WHERE {$w} ORDER BY p.scheduled_at ASC LIMIT 500";
    Response::ok(DB::all($sql, $params));
});

$router->get('/posts/stats',function(){ Response::ok(PostModel::stats()); });
$router->get('/posts/{id}',function(array $p){ Response::ok(PostModel::get((int)$p['id'])); });
$router->put('/posts/{id}',function(array $p){ PostModel::update((int)$p['id'],body());Response::ok(null,'Updated'); });
$router->delete('/posts/{id}',function(array $p){ PostModel::delete((int)$p['id']);Response::ok(null,'Deleted'); });
$router->post('/posts/bulk-delete',function(){
    Auth::requireRole('admin','editor');
    $ids=array_map('intval',(array)(body()['ids']??[]));
    if(!$ids) Response::json(['error'=>'No ids provided'],400);
    $ph=implode(',',array_fill(0,count($ids),'?'));
    DB::run("DELETE FROM posts WHERE id IN($ph)",$ids);
    DB::run("DELETE FROM publish_queue WHERE post_id IN($ph)",$ids);
    Response::ok(['deleted'=>count($ids)],count($ids).' posts deleted');
});
$router->post('/queue/bulk-delete',function(){
    Auth::requireRole('admin','editor');
    $ids=array_map('intval',(array)(body()['ids']??[]));
    if(!$ids) Response::json(['error'=>'No ids provided'],400);
    $ph=implode(',',array_fill(0,count($ids),'?'));
    DB::run("DELETE FROM publish_queue WHERE id IN($ph)",$ids);
    Response::ok(['deleted'=>count($ids)],count($ids).' queue items removed');
});
$router->post('/posts/{id}/publish-now',function(array $p){
    Auth::requireRole('admin','editor');$id=(int)$p['id'];
    DB::update('posts',['status'=>'scheduled','scheduled_at'=>date('Y-m-d H:i:s')],'id=?',[$id]);
    if(!DB::one('SELECT id FROM publish_queue WHERE post_id=?',[$id]))
        DB::insert('publish_queue',['post_id'=>$id,'fire_at'=>date('Y-m-d H:i:s'),'priority'=>1]);
    Response::ok(null,'Queued');
});
$router->post('/posts/{id}/submit',function(array $p){
    $u=Auth::require();$id=(int)$p['id'];$post=PostModel::get($id);
    if($post['author_id']!=$u['id']&&$u['role']!=='admin') throw new AuthException('Not your post');
    DB::update('posts',['status'=>'pending_approval'],'id=?',[$id]);
    NotificationService::approvalRequired($id,$post['caption']??'Post',$u['name']??'A user');
    Response::ok(null,'Submitted for approval');
});
$router->post('/posts/{id}/approve',function(array $p){
    $u=Auth::requireRole('admin','editor');$id=(int)$p['id'];$post=PostModel::get($id);
    $sa=$post['scheduled_at'];
    DB::update('posts',['status'=>'scheduled','scheduled_at'=>$sa?:date('Y-m-d H:i:s'),'approved_by'=>$u['id'],'approved_at'=>date('Y-m-d H:i:s'),'reject_reason'=>null],'id=?',[$id]);
    if(!DB::one('SELECT id FROM publish_queue WHERE post_id=?',[$id]))
        DB::insert('publish_queue',['post_id'=>$id,'fire_at'=>$sa?:date('Y-m-d H:i:s'),'priority'=>3]);
    else DB::update('publish_queue',['fire_at'=>$sa?:date('Y-m-d H:i:s'),'locked_at'=>null],'post_id=?',[$id]);
    Response::ok(null,'Approved & scheduled');
});
$router->post('/posts/{id}/reject',function(array $p){
    $u=Auth::requireRole('admin','editor');$id=(int)$p['id'];$b=body();
    DB::update('posts',['status'=>'rejected','reject_reason'=>$b['reason']??'Rejected'],'id=?',[$id]);
    DB::run('DELETE FROM publish_queue WHERE post_id=?',[$id]);
    Response::ok(null,'Rejected');
});
$router->post('/posts/{id}/retry',function(array $p){
    Auth::requireRole('admin','editor');$id=(int)$p['id'];
    DB::run("UPDATE post_targets SET status='pending',attempts=0,error_message=NULL WHERE post_id=? AND status='failed'",[$id]);
    DB::update('posts',['status'=>'scheduled'],'id=?',[$id]);
    if(!DB::one('SELECT id FROM publish_queue WHERE post_id=?',[$id]))
        DB::insert('publish_queue',['post_id'=>$id,'fire_at'=>date('Y-m-d H:i:s'),'priority'=>1]);
    else DB::update('publish_queue',['fire_at'=>date('Y-m-d H:i:s'),'locked_at'=>null,'attempts'=>0],'post_id=?',[$id]);
    Response::ok(null,'Re-queued for retry');
});
$router->get('/approvals',function(){
    Auth::require();
    Response::ok(DB::all("SELECT p.id,p.caption,p.status,p.scheduled_at,u.name author,s.name site_name FROM posts p JOIN users u ON u.id=p.author_id JOIN sites s ON s.id=p.site_id WHERE p.status='pending_approval' ORDER BY p.created_at DESC"));
});

// AI
$router->post('/ai/caption',function(){ Auth::require();Response::ok(['caption'=>AIService::generateCaption(body())]); });
$router->post('/ai/generate',function(){ Auth::require();Response::ok(['caption'=>AIService::generateCaption(body())]); }); // alias for Settings test button
$router->post('/ai/improve',function(){
    Auth::require();$b=body();required($b,['caption','instruction']);
    Response::ok(['caption'=>AIService::improveCaption($b['caption'],$b['instruction'])]);
});

// SITES
$router->get('/sites',function(){ Auth::require();Response::ok(DB::all('SELECT * FROM sites WHERE active=1 ORDER BY name')); });
$router->post('/sites',function(){
    Auth::requireRole('admin');$b=body();required($b,['name','domain']);
    $id=DB::insert('sites',['name'=>$b['name'],'domain'=>$b['domain'],'category'=>$b['category']??'other','color'=>$b['color']??'#C9A84C','accent'=>$b['accent']??'#0A1F44']);
    Response::ok(['id'=>$id],'Site added');
});
$router->put('/sites/{id}',function(array $p){
    Auth::requireRole('admin');$b=body();
    $u=array_intersect_key($b,array_flip(['name','domain','category','color','accent','active']));
    DB::update('sites',$u,'id=?',[(int)$p['id']]);Response::ok(null,'Updated');
});

// PLATFORMS
$router->get('/platforms',function(){ Auth::require();Response::ok(DB::all("SELECT * FROM platforms WHERE active=1 AND key_name<>'sms' ORDER BY name")); });

// CONNECTIONS
$router->get('/connections',function(){
    Auth::require();$sid=param('site_id');
    $w=$sid?'WHERE pc.site_id=?':'WHERE 1=1';$params=$sid?[(int)$sid]:[];
    $w .= " AND pl.key_name<>'sms'";
    Response::ok(DB::all("SELECT pc.*,s.name as site_name,pl.name as platform_name,pl.key_name,pl.color FROM platform_connections pc JOIN sites s ON s.id=pc.site_id JOIN platforms pl ON pl.id=pc.platform_id {$w} ORDER BY s.name,pl.name",$params));
});
$router->post('/connections',function(){
    Auth::requireRole('admin');$b=body();required($b,['site_id','platform_id','account_name']);
    $plat=DB::one('SELECT key_name FROM platforms WHERE id=?',[(int)$b['platform_id']]);
    if($plat && $plat['key_name']==='sms') throw new ValidationException('SMS is disabled. Use WhatsApp or email.');
    $token=$b['access_token']??null; $extra=isset($b['extra'])&&is_array($b['extra'])?$b['extra']:[];
    // Validate Telegram bot token on save
    if($plat && $plat['key_name']==='telegram' && $token){
        $ch=curl_init('https://api.telegram.org/bot'.$token.'/getMe');
        curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>15]);
        $raw=curl_exec($ch);$me=json_decode($raw,true);curl_close($ch);
        if(!($me['ok']??false)) throw new ValidationException('Telegram rejected the bot token. Re-check it from @BotFather.');
        $extra['bot_username']=$me['result']['username']??null;
    }
    // Validate Discord webhook URL on save
    if($plat && $plat['key_name']==='discord' && $token){
        if(!str_starts_with($token,'https://discord.com/api/webhooks/'))
            throw new ValidationException('Invalid Discord webhook URL.');
    }
    $enc = $token ? Crypto::enc($token) : null;
    $fields=['site_id'=>(int)$b['site_id'],'platform_id'=>(int)$b['platform_id'],'account_name'=>$b['account_name'],'account_id'=>$b['account_id']??null,'access_token'=>$enc,'connected'=>1,'extra'=>$extra?json_encode($extra):null];
    $exists=DB::one('SELECT id FROM platform_connections WHERE site_id=? AND platform_id=?',[(int)$b['site_id'],(int)$b['platform_id']]);
    if($exists){ DB::update('platform_connections',$fields,'id=?',[$exists['id']]); $id=$exists['id']; }
    else { $id=DB::insert('platform_connections',$fields); }
    Response::ok(['id'=>$id,'bot_username'=>$extra['bot_username']??null],'Connection saved');
});
$router->delete('/connections/{id}',function(array $p){
    Auth::requireRole('admin');DB::run('DELETE FROM platform_connections WHERE id=?',[(int)$p['id']]);Response::ok(null,'Removed');
});

// MEDIA
$router->post('/media/upload',function(){
    $user=Auth::require();
    if(empty($_FILES['file'])) throw new ValidationException('No file');
    $f=$_FILES['file'];$mime=mime_content_type($f['tmp_name']);
    if(!in_array($mime,['image/jpeg','image/png','image/gif','image/webp','video/mp4'])) throw new ValidationException('File type not allowed');
    if($f['size']>8*1024*1024*1024) throw new ValidationException('File too large');
    if(!is_dir(MEDIA_PATH)) mkdir(MEDIA_PATH,0755,true);
    $ext=pathinfo($f['name'],PATHINFO_EXTENSION);$fn=uniqid('fp_',true).'.'.$ext;$path=MEDIA_PATH.'/'.$fn;
    move_uploaded_file($f['tmp_name'],$path);
    [$w,$h]=str_starts_with($mime,'image/')?(@getimagesize($path)?:[null,null]):[null,null];
    $id=DB::insert('media',['site_id'=>(int)($_POST['site_id']??0)?:null,'uploader_id'=>$user['id'],'filename'=>$fn,'path'=>$path,'url'=>STORAGE_URL.'/'.$fn,'mime_type'=>$mime,'size'=>$f['size'],'width'=>$w,'height'=>$h,'alt_text'=>$_POST['alt_text']??null]);
    Response::ok(DB::one('SELECT * FROM media WHERE id=?',[$id]),'Uploaded');
});
$router->get('/media',function(){
    Auth::require();$sid=param('site_id');$p=max(1,(int)param('page',1));$limit=24;$off=($p-1)*$limit;
    $w=$sid?'WHERE site_id=?':'WHERE 1=1';$params=$sid?[(int)$sid]:[];
    Response::paginate(DB::all("SELECT * FROM media {$w} ORDER BY created_at DESC LIMIT {$limit} OFFSET {$off}",$params),DB::count("SELECT COUNT(*) FROM media {$w}",$params),$p,$limit);
});

// QUEUE
$router->get('/queue',function(){
    Auth::require();
    Response::ok(DB::all('SELECT pq.*,p.caption,p.status as post_status,s.name as site_name FROM publish_queue pq JOIN posts p ON p.id=pq.post_id JOIN sites s ON s.id=p.site_id ORDER BY pq.fire_at ASC LIMIT 50'));
});

// ACTIVITY
$router->get('/activity',function(){
    Auth::requireRole('admin');
    Response::ok(DB::all('SELECT al.*,u.name as user_name FROM activity_log al LEFT JOIN users u ON u.id=al.user_id ORDER BY al.created_at DESC LIMIT 100'));
});

// LABELS
$router->get('/labels',function(){ Auth::require();Response::ok(DB::all('SELECT * FROM labels ORDER BY name')); });
$router->post('/labels',function(){ Auth::requireRole('admin','editor');$b=body();required($b,['name']);$id=DB::insert('labels',['name'=>$b['name'],'color'=>$b['color']??'#5b3cf5']);Response::ok(['id'=>$id],'Label created'); });
$router->delete('/labels/{id}',function(array $p){ Auth::requireRole('admin','editor');DB::run('DELETE FROM labels WHERE id=?',[(int)$p['id']]);Response::ok(null,'Removed'); });
$router->post('/labels/bulk-delete',function(){ Auth::requireRole('admin','editor');$ids=array_map('intval',(array)(body()['ids']??[]));if(!$ids)Response::json(['error'=>'No ids'],400);$ph=implode(',',array_fill(0,count($ids),'?'));DB::run("DELETE FROM labels WHERE id IN($ph)",$ids);Response::ok(['deleted'=>count($ids)]); });

// TEMPLATES
$router->get('/templates',function(){ Auth::require();Response::ok(DB::all('SELECT * FROM templates ORDER BY created_at DESC')); });
$router->post('/templates',function(){ $u=Auth::require();$b=body();required($b,['name','body']);$id=DB::insert('templates',['name'=>$b['name'],'body'=>$b['body'],'tag'=>$b['tag']??null,'created_by'=>$u['id']]);Response::ok(['id'=>$id],'Template saved'); });
$router->put('/templates/{id}',function(array $p){ Auth::require();$b=body();$u=array_intersect_key($b,array_flip(['name','body','tag']));if($u)DB::update('templates',$u,'id=?',[(int)$p['id']]);Response::ok(null,'Updated'); });
$router->delete('/templates/{id}',function(array $p){ Auth::requireRole('admin','editor');DB::run('DELETE FROM templates WHERE id=?',[(int)$p['id']]);Response::ok(null,'Removed'); });

// ANALYTICS (summary across posts/targets)
$router->get('/analytics',function(){
    Auth::require();
    $days = max(1, min(365, (int)($_GET['days'] ?? 30)));
    $byPlat=DB::all("SELECT pl.name platform,pl.key_name,pl.color,COUNT(*) total,SUM(pt.status='published') published,SUM(pt.status='failed') failed FROM post_targets pt JOIN platforms pl ON pl.id=pt.platform_id WHERE pt.published_at>=DATE_SUB(NOW(),INTERVAL ? DAY) OR pt.published_at IS NULL GROUP BY pl.id ORDER BY published DESC", [$days]);
    $totals=DB::one("SELECT COUNT(*) posts,SUM(status='published') published,SUM(status='failed') failed,SUM(status IN('scheduled','queued','pending_approval')) upcoming FROM posts WHERE created_at>=DATE_SUB(NOW(),INTERVAL ? DAY)", [$days]);
    if ($days <= 60) {
        $series=DB::all("SELECT DATE(published_at) d, SUM(status='published') published, SUM(status='failed') failed, COUNT(*) total FROM post_targets WHERE published_at>=DATE_SUB(NOW(),INTERVAL ? DAY) GROUP BY DATE(published_at) ORDER BY d", [$days]);
    } else {
        $series=DB::all("SELECT DATE(MIN(published_at)) d, SUM(status='published') published, SUM(status='failed') failed, COUNT(*) total FROM post_targets WHERE published_at>=DATE_SUB(NOW(),INTERVAL ? DAY) GROUP BY YEARWEEK(published_at,1) ORDER BY d", [$days]);
    }
    $totalPub = DB::one("SELECT COUNT(*) n FROM post_targets WHERE status='published' AND published_at>=DATE_SUB(NOW(),INTERVAL ? DAY)", [$days]);
    $totalFail= DB::one("SELECT COUNT(*) n FROM post_targets WHERE status='failed' AND (published_at>=DATE_SUB(NOW(),INTERVAL ? DAY) OR last_attempt>=DATE_SUB(NOW(),INTERVAL ? DAY))", [$days, $days]);
    Response::ok(['by_platform'=>$byPlat,'totals'=>$totals,'series'=>$series,'period_published'=>(int)$totalPub['n'],'period_failed'=>(int)$totalFail['n'],'days'=>$days]);
});

// AI extras
$router->post('/ai/hashtags',function(){ Auth::require();$b=body();Response::ok(['hashtags'=>AIService::call_public($b['caption']??'')]); });

// USERS
$router->get('/users',function(){ Auth::requireRole('admin');Response::ok(DB::all('SELECT id,name,email,role,timezone,active,created_at FROM users ORDER BY name')); });
$router->post('/users',function(){
    Auth::requireRole('admin');$b=body();required($b,['name','email','password','role']);
    if(DB::one('SELECT id FROM users WHERE email=?',[$b['email']])) throw new ValidationException('Email already in use');
    $id=DB::insert('users',['name'=>$b['name'],'email'=>$b['email'],'password'=>password_hash($b['password'],PASSWORD_BCRYPT),'role'=>$b['role'],'timezone'=>$b['timezone']??APP_TIMEZONE]);
    Response::ok(['id'=>$id],'User created');
});
$router->put('/users/{id}',function(array $p){
    Auth::requireRole('admin');$b=body();$u=[];
    foreach(['name','email','role','timezone','active'] as $k) if(isset($b[$k]))$u[$k]=$b[$k];
    if(!empty($b['password']))$u['password']=password_hash($b['password'],PASSWORD_BCRYPT);
    if($u) DB::update('users',$u,'id=?',[(int)$p['id']]);
    Response::ok(null,'Updated');
});

// SETTINGS
$router->get('/settings',function(){
    Auth::requireRole('admin');
    $rows=DB::all('SELECT key_name,value FROM settings');
    Response::ok(array_column($rows,'value','key_name'));
});
$router->put('/settings',function(){
    Auth::requireRole('admin');
    foreach(body() as $k=>$v) DB::run('INSERT INTO settings (key_name,value) VALUES (?,?) ON DUPLICATE KEY UPDATE value=?',[$k,$v,$v]);
    Response::ok(null,'Saved');
});


// PASSWORD RESET
$router->post('/auth/forgot-password', function() {
    $b = body();
    required($b, ['email']);
    $user = DB::one('SELECT id, name, email FROM users WHERE email=? AND active=1', [$b['email']]);
    if ($user) {
        $token = bin2hex(random_bytes(32));
        $expires = date('Y-m-d H:i:s', time() + 3600);
        DB::run('DELETE FROM password_resets WHERE email=?', [$user['email']]);
        DB::insert('password_resets', ['email' => $user['email'], 'token' => $token, 'expires_at' => $expires]);
        $resetUrl = APP_URL . '/reset-password?token=' . $token;
        $subject = 'Reset your FlowPost password';
        $message = "Hi " . $user['name'] . ",\n\nClick the link below to reset your FlowPost password (expires in 1 hour):\n\n" . $resetUrl . "\n\nIf you did not request this, please ignore this email.\n\n— FlowPost";
        $headers = "From: FlowPost <noreply@flomicso.dev>\r\nX-Mailer: FlowPost";
        @mail($user['email'], $subject, $message, $headers);
    }
    Response::ok(null, 'If that email exists, a reset link has been sent.');
});

$router->post('/auth/reset-password', function() {
    $b = body();
    required($b, ['token', 'password']);
    if (strlen($b['password']) < 8) throw new ValidationException('Password must be at least 8 characters');
    $reset = DB::one('SELECT * FROM password_resets WHERE token=? AND expires_at > NOW() AND used_at IS NULL', [$b['token']]);
    if (!$reset) throw new ValidationException('Invalid or expired reset link. Please request a new one.');
    $hash = password_hash($b['password'], PASSWORD_BCRYPT);
    DB::update('users', ['password' => $hash], 'email=?', [$reset['email']]);
    DB::update('password_resets', ['used_at' => date('Y-m-d H:i:s')], 'token=?', [$b['token']]);
    DB::run('DELETE FROM sessions WHERE user_id=(SELECT id FROM users WHERE email=?)', [$reset['email']]);
    Response::ok(null, 'Password updated successfully. You can now log in.');
});

$router->get('/auth/verify-reset-token', function() {
    $token = param('token');
    if (!$token) throw new ValidationException('Token required');
    $reset = DB::one('SELECT email FROM password_resets WHERE token=? AND expires_at > NOW() AND used_at IS NULL', [$token]);
    if (!$reset) throw new ValidationException('This reset link is invalid or has expired.');
    Response::ok(['email' => $reset['email']]);
});


// META OAUTH ROUTES
$router->get('/oauth/meta/start', function() {
    // No auth check - redirect to Facebook
    $type   = $_GET['type'] ?? 'facebook';
    $siteId = $_GET['site_id'] ?? '';
    $state  = base64_encode(json_encode(['type'=>$type,'site_id'=>$siteId,'csrf'=>bin2hex(random_bytes(8))]));
    session_start();
    $_SESSION['meta_state'] = $state;
    header('Location: ' . MetaOAuth::authUrl($state, $type)); exit;
});

$router->get('/oauth/meta/callback', function() {
    $code  = $_GET['code']  ?? '';
    $state = $_GET['state'] ?? '';
    $err   = $_GET['error'] ?? '';
    if ($err || !$code) { header('Location: /?oauth_error='.urlencode($err ?: 'no_code')); exit; }
    $sd     = json_decode(base64_decode($state), true) ?? [];
    $type   = $sd['type']    ?? 'facebook';
    $siteId = (int)($sd['site_id'] ?? 1);
    try {
        $userToken = MetaOAuth::exchangeCode($code)['access_token'];
        $pages     = MetaOAuth::getPages($userToken);
        $n = 0;
        foreach ($pages as $page) {
            $pt = $page['access_token']; $pid = $page['id']; $pname = $page['name'];
            if (in_array($type, ['instagram','both'])) {
                $ig = MetaOAuth::getIGAccount($pid, $pt);
                if ($ig) {
                    $plid = DB::one('SELECT id FROM platforms WHERE key_name=?',['instagram'])['id'] ?? null;
                    if ($plid) {
                        $f=['site_id'=>$siteId,'platform_id'=>$plid,'account_name'=>$ig['username']??$ig['name'],'account_id'=>$ig['id'],'access_token'=>Crypto::enc($pt),'connected'=>1,'extra'=>json_encode(['page_id'=>$pid,'page_name'=>$pname])];
                        $ex=DB::one('SELECT id FROM platform_connections WHERE site_id=? AND platform_id=? AND account_id=?',[$siteId,$plid,$ig['id']]);
                        if($ex) DB::update('platform_connections',$f,'id=?',[$ex['id']]); else DB::insert('platform_connections',$f);
                        $n++;
                    }
                }
            }
            if (in_array($type, ['facebook','both'])) {
                $plid = DB::one('SELECT id FROM platforms WHERE key_name=?',['facebook'])['id'] ?? null;
                if ($plid) {
                    $f=['site_id'=>$siteId,'platform_id'=>$plid,'account_name'=>$pname,'account_id'=>$pid,'access_token'=>Crypto::enc($pt),'connected'=>1,'extra'=>json_encode([])];
                    $ex=DB::one('SELECT id FROM platform_connections WHERE site_id=? AND platform_id=? AND account_id=?',[$siteId,$plid,$pid]);
                    if($ex) DB::update('platform_connections',$f,'id=?',[$ex['id']]); else DB::insert('platform_connections',$f);
                    $n++;
                }
            }
        }
        header('Location: /?oauth_success=meta&connected='.$n); exit;
    } catch (Exception $e) {
        header('Location: /?oauth_error='.urlencode($e->getMessage())); exit;
    }
});


// PINTEREST OAUTH
$router->get('/oauth/pinterest/start', function() {
    $siteId = $_GET['site_id'] ?? '3';
    $state = base64_encode(json_encode(['site_id'=>$siteId,'csrf'=>bin2hex(random_bytes(8))]));
    header('Location: ' . PinterestOAuth::authUrl($state)); exit;
});
$router->get('/oauth/pinterest/callback', function() {
    $code = $_GET['code'] ?? ''; $state = $_GET['state'] ?? '';
    if (!$code) { header('Location: /?oauth_error=pinterest_no_code'); exit; }
    $sd = json_decode(base64_decode($state), true) ?? [];
    $siteId = (int)($sd['site_id'] ?? 3);
    try {
        $tok = PinterestOAuth::exchangeCode($code);
        $token = $tok['access_token'];
        $user = PinterestOAuth::getUser($token);
        $boards = PinterestOAuth::getBoards($token);
        $platId = DB::one('SELECT id FROM platforms WHERE key_name=?',['pinterest'])['id'] ?? null;
        $n = 0;
        if ($platId) {
            // Connect first board or user profile as default
            $board = !empty($boards) ? $boards[0] : null;
            $accountId = $board ? $board['id'] : ($user['username'] ?? 'me');
            $accountName = $board ? $board['name'] : ($user['username'] ?? 'Pinterest');
            $fields = ['site_id'=>$siteId,'platform_id'=>$platId,'account_name'=>$accountName,'account_id'=>$accountId,'access_token'=>Crypto::enc($token),'connected'=>1,'extra'=>json_encode(['username'=>$user['username']??null,'all_boards'=>array_map(fn($b)=>['id'=>$b['id'],'name'=>$b['name']],$boards)])];
            $ex = DB::one('SELECT id FROM platform_connections WHERE site_id=? AND platform_id=? AND account_name=?',[$siteId,$platId,$accountName]);
            if($ex) DB::update('platform_connections',$fields,'id=?',[$ex['id']]); else DB::insert('platform_connections',$fields);
            $n++;
        }
        header('Location: /?oauth_success=pinterest&connected='.$n); exit;
    } catch(Exception $e) { header('Location: /?oauth_error='.urlencode($e->getMessage())); exit; }
});



// TIKTOK OAUTH
$router->get('/oauth/tiktok/start', function() {
    $siteId = $_GET['site_id'] ?? '1';
    $state = base64_encode(json_encode(['site_id'=>$siteId,'csrf'=>bin2hex(random_bytes(8))]));
    header('Location: ' . TikTokOAuth::authUrl($state)); exit;
});
$router->get('/oauth/tiktok/callback', function() {
    $code = $_GET['code'] ?? ''; $state = $_GET['state'] ?? ''; $err = $_GET['error'] ?? '';
    if ($err || !$code) { header('Location: /?oauth_error='.urlencode($err?:'no_code')); exit; }
    $sd = json_decode(base64_decode($state), true) ?? [];
    $siteId = (int)($sd['site_id'] ?? 1);
    try {
        $tok = TikTokOAuth::exchangeCode($code);
        $token = $tok['access_token'];
        $user = TikTokOAuth::getUser($token);
        $name = $user['display_name'] ?? 'TikTok User';
        $uid  = $user['open_id'] ?? '';
        $platId = DB::one('SELECT id FROM platforms WHERE key_name=?',['tiktok'])['id'] ?? null;
        if ($platId) {
            $f = ['site_id'=>$siteId,'platform_id'=>$platId,'account_name'=>$name,'account_id'=>$uid,'access_token'=>Crypto::enc($token),'connected'=>1];
            $ex = DB::one('SELECT id FROM platform_connections WHERE site_id=? AND platform_id=? AND account_id=?',[$siteId,$platId,$uid]);
            if ($ex) DB::update('platform_connections',$f,'id=?',[$ex['id']]); else DB::insert('platform_connections',$f);
        }
        header('Location: /?oauth_success=tiktok&connected=1'); exit;
    } catch(Exception $e) { header('Location: /?oauth_error='.urlencode($e->getMessage())); exit; }
});

// YOUTUBE OAUTH
$router->get('/oauth/youtube/start', function() {
    $siteId = $_GET['site_id'] ?? '1';
    $state = base64_encode(json_encode(['site_id'=>$siteId,'csrf'=>bin2hex(random_bytes(8))]));
    header('Location: ' . YouTubeOAuth::authUrl($state)); exit;
});
$router->get('/oauth/youtube/callback', function() {
    $code = $_GET['code'] ?? ''; $state = $_GET['state'] ?? ''; $err = $_GET['error'] ?? '';
    if ($err || !$code) { header('Location: /?oauth_error='.urlencode($err?:'no_code')); exit; }
    $sd = json_decode(base64_decode($state), true) ?? [];
    $siteId = (int)($sd['site_id'] ?? 1);
    try {
        $tok = YouTubeOAuth::exchangeCode($code);
        $token = $tok['access_token'];
        $refresh = $tok['refresh_token'] ?? null;
        $ch = YouTubeOAuth::getChannel($token);
        $name = $ch['snippet']['title'] ?? 'YouTube Channel';
        $uid  = $ch['id'] ?? '';
        $platId = DB::one('SELECT id FROM platforms WHERE key_name=?',['youtube'])['id'] ?? null;
        if ($platId) {
            $f = ['site_id'=>$siteId,'platform_id'=>$platId,'account_name'=>$name,'account_id'=>$uid,'access_token'=>Crypto::enc($token),'refresh_token'=>$refresh?Crypto::enc($refresh):null,'connected'=>1];
            $ex = DB::one('SELECT id FROM platform_connections WHERE site_id=? AND platform_id=? AND account_id=?',[$siteId,$platId,$uid]);
            if ($ex) DB::update('platform_connections',$f,'id=?',[$ex['id']]); else DB::insert('platform_connections',$f);
        }
        header('Location: /?oauth_success=youtube&connected=1'); exit;
    } catch(Exception $e) { header('Location: /?oauth_error='.urlencode($e->getMessage())); exit; }
});

// LINKEDIN OAUTH
$router->get('/oauth/linkedin/start', function() {
    $siteId = $_GET['site_id'] ?? '1';
    $state = base64_encode(json_encode(['site_id'=>$siteId,'csrf'=>bin2hex(random_bytes(8))]));
    header('Location: ' . LinkedInOAuth::authUrl($state)); exit;
});
$router->get('/oauth/linkedin/callback', function() {
    $code = $_GET['code'] ?? ''; $state = $_GET['state'] ?? ''; $err = $_GET['error'] ?? '';
    if ($err || !$code) { header('Location: /?oauth_error='.urlencode($err?:'no_code')); exit; }
    $sd = json_decode(base64_decode($state), true) ?? [];
    $siteId = (int)($sd['site_id'] ?? 1);
    try {
        $tok   = LinkedInOAuth::exchangeCode($code);
        $token = $tok['access_token'];
        $prof  = LinkedInOAuth::getMe($token);
        $name  = $prof['name'] ?? 'LinkedIn User';
        $uid   = $prof['sub'] ?? '';
        $platId = DB::one('SELECT id FROM platforms WHERE key_name=?',['linkedin'])['id'] ?? null;
        if ($platId) {
            $f = ['site_id'=>$siteId,'platform_id'=>$platId,'account_name'=>$name,'account_id'=>$uid,'access_token'=>Crypto::enc($token),'connected'=>1];
            $ex = DB::one('SELECT id FROM platform_connections WHERE site_id=? AND platform_id=? AND account_id=?',[$siteId,$platId,$uid]);
            if ($ex) DB::update('platform_connections',$f,'id=?',[$ex['id']]); else DB::insert('platform_connections',$f);
        }
        header('Location: /?oauth_success=linkedin&connected=1'); exit;
    } catch(Exception $e) { header('Location: /?oauth_error='.urlencode($e->getMessage())); exit; }
});

// REDDIT OAUTH
$router->get('/oauth/reddit/start', function() {
    $siteId = $_GET['site_id'] ?? '3';
    $state = base64_encode(json_encode(['site_id'=>$siteId,'csrf'=>bin2hex(random_bytes(8))]));
    header('Location: ' . RedditOAuth::authUrl($state)); exit;
});





// ── Disabled legacy phone calling ──────────────────────────────────────────
$router->get('/calls/token', function() {
    Auth::require();
    Response::json(['error'=>'Phone calling is disabled. Use WhatsApp or email.'], 410);
});

// TwiML endpoint for outbound calls
$router->post('/calls/twiml', function() {
    header('Content-Type: text/xml');
    echo '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Phone calling is disabled. Please use WhatsApp or email.</Say></Response>';
    exit;
});



// ── Disabled legacy inbound call handler ──────────────────────────────────
$router->post('/calls/inbound', function() {
    header('Content-Type: text/xml');
    echo '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Phone calling is disabled. Please use WhatsApp or email.</Say></Response>';
    exit;
});

$router->get('/calls/inbound', function() {
    header('Content-Type: text/xml');
    echo '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Phone calling is disabled. Please use WhatsApp or email.</Say></Response>';
    exit;
});

// ── Disabled legacy outbound calling ──────────────────────────────────────
$router->post('/calls/initiate', function() {
    Auth::require();
    Response::json(['error'=>'Phone calling is disabled. Use WhatsApp or email.'], 410);
});

$router->get('/calls/status', function() {
    Auth::require();
    Response::json(['error'=>'Phone calling is disabled. Use WhatsApp or email.'], 410);
});

$router->post('/calls/end', function() {
    Auth::require();
    Response::json(['error'=>'Phone calling is disabled. Use WhatsApp or email.'], 410);
});


$router->get('/oauth/twitter/start', function() {
    $siteId   = param('site_id', 1);
    $clientId = getenv('TWITTER_CLIENT_ID');
    if (!$clientId) { header('Location: /connections?error=no_twitter_client_id'); exit; }
    $verifier  = bin2hex(random_bytes(32));
    $challenge = rtrim(strtr(base64_encode(hash('sha256',$verifier,true)),'+/','-_'),'=');
    $state = base64_encode(json_encode(['site_id'=>(int)$siteId,'verifier'=>$verifier,'csrf'=>bin2hex(random_bytes(8))]));
    $params = http_build_query([
        'response_type'         => 'code',
        'client_id'             => $clientId,
        'redirect_uri'          => rtrim(APP_URL,'/').'/api/oauth/twitter/callback',
        'scope'                 => 'tweet.read tweet.write users.read offline.access',
        'state'                 => $state,
        'code_challenge'        => $challenge,
        'code_challenge_method' => 'S256',
    ]);
    header('Location: https://twitter.com/i/oauth2/authorize?'.$params);
    exit;
});

$router->get('/oauth/twitter/callback', function() {
    $code  = param('code');
    $state = param('state');
    if (!$code) { header('Location: /connections?error=twitter_no_code'); exit; }
    $sd       = json_decode(base64_decode($state), true) ?? [];
    $siteId   = (int)($sd['site_id']  ?? 1);
    $verifier = $sd['verifier'] ?? '';
    $clientId  = getenv('TWITTER_CLIENT_ID');
    $clientSec = getenv('TWITTER_CLIENT_SECRET');
    if (!$verifier) { header('Location: /connections?error=twitter_no_verifier'); exit; }
    $ch = curl_init('https://api.twitter.com/2/oauth2/token');
    curl_setopt_array($ch,[
        CURLOPT_RETURNTRANSFER=>true, CURLOPT_POST=>true,
        CURLOPT_USERPWD=>"{$clientId}:{$clientSec}",
        CURLOPT_POSTFIELDS=>http_build_query([
            'grant_type'    => 'authorization_code',
            'code'          => $code,
            'redirect_uri'  => rtrim(APP_URL,'/').'/api/oauth/twitter/callback',
            'code_verifier' => $verifier,
        ]),
    ]);
    $tok = json_decode(curl_exec($ch),true); curl_close($ch);
    if (empty($tok['access_token'])) {
        header('Location: /connections?error=twitter_token_failed&detail='.urlencode(json_encode($tok))); exit;
    }
    $ch2 = curl_init('https://api.twitter.com/2/users/me');
    curl_setopt_array($ch2,[CURLOPT_RETURNTRANSFER=>true,
        CURLOPT_HTTPHEADER=>["Authorization: Bearer {$tok['access_token']}"]]);
    $me = json_decode(curl_exec($ch2),true)['data'] ?? []; curl_close($ch2);
    $plid  = DB::one('SELECT id FROM platforms WHERE key_name=?',['twitter'])['id'] ?? 3;
    $extra = json_encode(['refresh_token'=>$tok['refresh_token']??null]);
    $enc   = Crypto::enc($tok['access_token']);
    $exist = DB::one('SELECT id FROM platform_connections WHERE site_id=? AND platform_id=?',[$siteId,$plid]);
    if ($exist) {
        DB::update('platform_connections',['access_token'=>$enc,'account_name'=>($me['name']??'X Account').' (X)','account_id'=>$me['id']??'','extra'=>$extra,'connected'=>1],'id=?',[$exist['id']]);
    } else {
        DB::insert('platform_connections',['site_id'=>$siteId,'platform_id'=>$plid,'account_name'=>($me['name']??'X Account').' (X)','account_id'=>$me['id']??'','access_token'=>$enc,'extra'=>$extra,'connected'=>1]);
    }
    header('Location: /connections?success=twitter'); exit;
});

$router->get('/oauth/reddit/callback', function() {
    $code = $_GET['code'] ?? ''; $state = $_GET['state'] ?? ''; $err = $_GET['error'] ?? '';
    if ($err || !$code) { header('Location: /?oauth_error=reddit_'.urlencode($err?:'no_code')); exit; }
    $sd = json_decode(base64_decode($state), true) ?? [];
    $siteId = (int)($sd['site_id'] ?? 3);
    try {
        $tok = RedditOAuth::exchangeCode($code);
        $token = $tok['access_token'];
        $refresh = $tok['refresh_token'] ?? null;
        $user = RedditOAuth::getUser($token);
        $username = $user['name'] ?? 'reddit_user';
        $platId = DB::one('SELECT id FROM platforms WHERE key_name=?',['reddit'])['id'] ?? null;
        $n = 0;
        if ($platId) {
            $fields = ['site_id'=>$siteId,'platform_id'=>$platId,'account_name'=>'u/'.$username,'account_id'=>$username,'access_token'=>Crypto::enc($token),'refresh_token'=>$refresh ? Crypto::enc($refresh) : null,'connected'=>1];
            $ex = DB::one('SELECT id FROM platform_connections WHERE site_id=? AND platform_id=? AND account_name=?',[$siteId,$platId,'u/'.$username]);
            if($ex) DB::update('platform_connections',$fields,'id=?',[$ex['id']]); else DB::insert('platform_connections',$fields);
            $n++;
        }
        header('Location: /?oauth_success=reddit&connected='.$n); exit;
    } catch(Exception $e) { header('Location: /?oauth_error='.urlencode($e->getMessage())); exit; }
});




// AI IMAGE GENERATION
$router->post('/ai/generate-image', function() {
    Auth::require();
    $b = body();
    $prompt = $b['prompt'] ?? '';
    $size   = $b['size']   ?? '1024x1024';
    if (!$prompt) throw new ValidationException('Prompt is required');

    $provider = getenv('AI_IMAGE_PROVIDER') ?: 'dall-e';
    $openaiKey = getenv('OPENAI_API_KEY') ?: '';
    $geminiKey = getenv('GEMINI_API_KEY') ?: '';

    if ($provider === 'dall-e' || !$provider) {
        if (!$openaiKey) throw new RuntimeException('OpenAI API key not configured');
        $ch = curl_init('https://api.openai.com/v1/images/generations');
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_POST=>true,
            CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: Bearer '.$openaiKey],
            CURLOPT_POSTFIELDS=>json_encode(['model'=>'gpt-image-1','prompt'=>$prompt,'n'=>1,'size'=>$size]),
            CURLOPT_TIMEOUT=>120]);
        $raw = curl_exec($ch); curl_close($ch);
        $d = json_decode($raw, true);
        if (!empty($d['error'])) throw new RuntimeException('Image: '.$d['error']['message']);
        // gpt-image-1 returns b64_json, save to file
        $b64 = $d['data'][0]['b64_json'] ?? null;
        $url = $d['data'][0]['url'] ?? null;
        if ($b64) {
            $fname = 'ai_img_'.time().'.png';
            $path = STORAGE_PATH.'/media/'.$fname;
            @mkdir(dirname($path),0775,true);
            file_put_contents($path, base64_decode($b64));
            $url = rtrim(APP_URL,'/').'/storage/media/'.$fname;
            $mediaId = DB::insert('media',['uploader_id'=>1,'filename'=>$fname,'path'=>'media/'.$fname,'url'=>$url,'mime_type'=>'image/png','alt_text'=>'AI: '.$prompt]);
        }
        Response::ok(['url'=>$url,'media_id'=>$mediaId??null,'provider'=>'gpt-image-1']);
    } else {
        throw new RuntimeException('Image provider not supported yet: '.$provider);
    }
});

// AI VOICE GENERATION
$router->post('/ai/generate-voice', function() {
    Auth::require();
    $b = body();
    $text  = $b['text']  ?? '';
    $voice = $b['voice'] ?? 'alloy';
    if (!$text) throw new ValidationException('Text is required');

    $openaiKey = getenv('OPENAI_API_KEY') ?: '';
    if (!$openaiKey) throw new RuntimeException('OpenAI API key not configured');

    $ch = curl_init('https://api.openai.com/v1/audio/speech');
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_POST=>true,
        CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: Bearer '.$openaiKey],
        CURLOPT_POSTFIELDS=>json_encode(['model'=>'tts-1','input'=>$text,'voice'=>$voice]),
        CURLOPT_TIMEOUT=>60]);
    $raw = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    if ($code !== 200) throw new RuntimeException('Voice generation failed');

    // Save audio file and add to media library
    $filename = 'voice_'.time().'.mp3';
    $path = STORAGE_PATH.'/media/'.$filename;
    @mkdir(dirname($path), 0775, true);
    file_put_contents($path, $raw);
    $url = rtrim(APP_URL,'/').'/storage/media/'.$filename;
    $user = Auth::user();
    $mediaId = DB::insert('media',['uploader_id'=>$user['id'],'filename'=>$filename,'path'=>'media/'.$filename,'url'=>$url,'mime_type'=>'audio/mpeg','size'=>strlen($raw),'alt_text'=>'AI Voice: '.substr($text,0,50)]);
    Response::ok(['url'=>$url,'filename'=>$filename,'media_id'=>$mediaId]);
});



// AI VIDEO GENERATION (Google Veo via Gemini)
$router->post('/ai/generate-video', function() {
    Auth::require();
    $b = body();
    $prompt   = $b['prompt']    ?? '';
    $duration = (int)($b['duration'] ?? 5);
    if (!$prompt) throw new ValidationException('Prompt is required');

    $geminiKey = getenv('GEMINI_API_KEY') ?: '';
    if (!$geminiKey) throw new RuntimeException('Gemini API key not configured');

    $payload = [
        'instances'  => [['prompt' => $prompt]],
        'parameters' => ['aspectRatio' => $b['ratio'] ?? '16:9', 'sampleCount' => 1, 'durationSeconds' => min(8, max(5, $duration))]
    ];

    $ch = curl_init('https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning?key='.$geminiKey);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_POST=>true,
        CURLOPT_HTTPHEADER=>['Content-Type: application/json'],
        CURLOPT_POSTFIELDS=>json_encode($payload), CURLOPT_TIMEOUT=>30]);
    $raw = curl_exec($ch); curl_close($ch);
    $d = json_decode($raw, true);

    if (!isset($d['name'])) throw new RuntimeException('Veo error: '.$raw);
    Response::ok(['task_id'=>$d['name'], 'status'=>'pending', 'message'=>'Video generation started (Veo 2)']);
});

// POLL VIDEO STATUS (Veo)
$router->post('/ai/video-status', function(array $p) {
    Auth::require();
    $geminiKey = getenv('GEMINI_API_KEY') ?: '';
    if (!$geminiKey) throw new RuntimeException('Gemini API key not configured');

    // task_id is URL-encoded operation name
    $opName = body()['task_id'] ?? '';
    $ch = curl_init('https://generativelanguage.googleapis.com/v1beta/'.$opName.'?key='.$geminiKey);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_TIMEOUT=>15]);
    $raw = curl_exec($ch); curl_close($ch);
    $d = json_decode($raw, true);

    $done = $d['done'] ?? false;
    $url  = null;
    if ($done) {
        $url = $d['response']['generateVideoResponse']['generatedSamples'][0]['video']['uri'] ?? null;
        if ($url) $url .= '&key='.$geminiKey;
    }
    Response::ok(['status' => $done ? 'SUCCEEDED' : 'pending', 'url' => $url, 'progress' => $done ? 1 : null]);
});


// RSS FEEDS
$router->get('/rss-feeds', function() {
    Auth::require();
    $feeds = DB::all("SELECT rf.*, s.name as site_name FROM rss_feeds rf JOIN sites s ON s.id=rf.site_id WHERE rf.active=1 ORDER BY rf.created_at DESC");
    Response::ok($feeds);
});

$router->post('/rss-feeds', function() {
    Auth::requireRole('admin','editor');
    $b = body(); required($b, ['site_id','url']);
    if (!filter_var($b['url'], FILTER_VALIDATE_URL)) throw new ValidationException('Invalid feed URL');
    $id = DB::insert('rss_feeds', [
        'site_id'         => (int)$b['site_id'],
        'url'             => $b['url'],
        'name'            => $b['name'] ?? $b['url'],
        'connection_ids'  => isset($b['connection_ids']) ? json_encode($b['connection_ids']) : null,
        'auto_post'       => (int)($b['auto_post'] ?? 0),
        'use_ai'          => (int)($b['use_ai'] ?? 0),
        'ai_tone'         => $b['ai_tone'] ?? 'engaging',
        'ai_instructions' => $b['ai_instructions'] ?? null,
        'template'        => $b['template'] ?? null,
        'active'          => 1,
    ]);
    Response::ok(['id'=>$id], 'Feed added');
});

$router->put('/rss-feeds/{id}', function(array $p) {
    Auth::requireRole('admin','editor');
    $b = body();
    DB::update('rss_feeds', [
        'name'            => $b['name'] ?? '',
        'connection_ids'  => isset($b['connection_ids']) ? json_encode($b['connection_ids']) : null,
        'auto_post'       => (int)($b['auto_post'] ?? 0),
        'use_ai'          => (int)($b['use_ai'] ?? 0),
        'ai_tone'         => $b['ai_tone'] ?? 'engaging',
        'ai_instructions' => $b['ai_instructions'] ?? null,
        'template'        => $b['template'] ?? null,
        'active'          => (int)($b['active'] ?? 1),
    ], 'id=?', [(int)$p['id']]);
    Response::ok(null, 'Feed updated');
});

$router->delete('/rss-feeds/{id}', function(array $p) {
    Auth::requireRole('admin','editor');
    DB::run('UPDATE rss_feeds SET active=0 WHERE id=?', [(int)$p['id']]);
    Response::ok(null, 'Feed removed');
});

$router->post('/rss-feeds/{id}/fetch', function(array $p) {
    Auth::require();
    $feed = DB::one('SELECT * FROM rss_feeds WHERE id=?', [(int)$p['id']]);
    if (!$feed) throw new NotFoundException('Feed not found');
    $count = RSSWorker::fetch($feed);
    Response::ok(['posts_created'=>$count], "Fetched: {$count} new posts");
});


// AI AUTO-SCHEDULE
$router->get('/ai-schedules', function() {
    Auth::require();
    $rows = DB::all("SELECT s.*, si.name as site_name FROM ai_schedules s JOIN sites si ON si.id=s.site_id WHERE s.active=1 ORDER BY s.created_at DESC");
    Response::ok($rows);
});
$router->post('/ai-schedules', function() {
    Auth::requireRole('admin','editor');
    $b = body(); required($b, ['site_id','name','topic','connection_ids']);
    $id = DB::insert('ai_schedules', [
        'site_id'       => (int)$b['site_id'],
        'name'          => $b['name'],
        'topic'         => $b['topic'],
        'tone'          => $b['tone'] ?? 'inspirational',
        'connection_ids'=> json_encode($b['connection_ids']),
        'frequency'     => $b['frequency'] ?? 'daily',
        'include_image' => (int)($b['include_image'] ?? 1),
        'image_prompt'  => $b['image_prompt'] ?? null,
        'active'        => 1,
        'next_run'      => date('Y-m-d H:i:s'),
    ]);
    Response::ok(['id'=>$id], 'AI Schedule created');
});
$router->put('/ai-schedules/{id}', function(array $p) {
    Auth::requireRole('admin','editor');
    $b = body();
    $fields = array_intersect_key($b, array_flip(['name','topic','tone','frequency','include_image','image_prompt','active']));
    if (isset($b['connection_ids'])) $fields['connection_ids'] = json_encode($b['connection_ids']);
    if (!empty($fields)) DB::update('ai_schedules', $fields, 'id=?', [(int)$p['id']]);
    Response::ok(null, 'Updated');
});
$router->delete('/ai-schedules/{id}', function(array $p) {
    Auth::requireRole('admin','editor');
    DB::update('ai_schedules', ['active'=>0], 'id=?', [(int)$p['id']]);
    Response::ok(null, 'Deleted');
});
$router->post('/ai-schedules/{id}/run-now', function(array $p) {
    Auth::require();
    DB::update('ai_schedules', ['next_run'=>date('Y-m-d H:i:s')], 'id=?', [(int)$p['id']]);
    Response::ok(null, 'Will run within 1 minute');
});

require_once __DIR__."/core/NotificationService.php";
require_once __DIR__."/core/InboxFetcher.php";
require_once __DIR__."/core/InsightsFetcher.php";

// INBOX
$router->get('/inbox', function() {
    Auth::require();
    $platform = param('platform');
    $type     = param('type');
    $unread   = param('unread');
    $page     = max(1,(int)param('page',1));
    $limit    = 30;
    $where = ['1=1']; $params = [];
    if ($platform) { $where[] = 'si.platform=?'; $params[] = $platform; }
    if ($type)     { $where[] = 'si.message_type=?'; $params[] = $type; }
    if ($unread === '1') { $where[] = 'si.is_read=0'; }
    $w = implode(' AND ', $where);
    $total = DB::count("SELECT COUNT(*) FROM social_inbox si WHERE $w", $params);
    $params[] = $limit; $params[] = ($page-1)*$limit;
    $items = DB::all("SELECT si.*,pc.account_name as connection_name FROM social_inbox si JOIN platform_connections pc ON pc.id=si.connection_id WHERE $w ORDER BY si.created_at DESC LIMIT ? OFFSET ?", $params);
    Response::paginate($items, $total, $page, $limit);
});

$router->post('/inbox/{id}/read', function(array $p) {
    Auth::require();
    DB::update('social_inbox', ['is_read'=>1], 'id=?', [(int)$p['id']]);
    Response::ok(null, 'Marked read');
});

$router->post('/inbox/read-all', function() {
    Auth::require();
    DB::run('UPDATE social_inbox SET is_read=1 WHERE is_read=0');
    Response::ok(null, 'All read');
});

$router->post('/inbox/{id}/reply', function(array $p) {
    Auth::require();
    $b = body();
    $msg = DB::one('SELECT * FROM social_inbox WHERE id=?', [(int)$p['id']]);
    if (!$msg) throw new NotFoundException('Message not found');
    $conn = DB::one('SELECT * FROM platform_connections WHERE id=?', [$msg['connection_id']]);
    $token = Crypto::dec($conn['access_token']);
    $text  = $b['reply'] ?? '';
    // Platform-specific reply
    switch ($msg['platform']) {
        case 'facebook':
        case 'instagram':
        case 'instagram_business':
            $ch = curl_init("https://graph.facebook.com/v19.0/{$msg['external_id']}/comments");
            curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_POST=>true,
                CURLOPT_POSTFIELDS=>http_build_query(['message'=>$text,'access_token'=>$token])]);
            curl_exec($ch); curl_close($ch);
            break;
        case 'youtube':
            $ch = curl_init('https://www.googleapis.com/youtube/v3/comments?part=snippet');
            curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_POST=>true,
                CURLOPT_POSTFIELDS=>json_encode(['snippet'=>['parentId'=>$msg['external_id'],'textOriginal'=>$text]]),
                CURLOPT_HTTPHEADER=>["Authorization: Bearer $token",'Content-Type: application/json']]);
            curl_exec($ch); curl_close($ch);
            break;
        case 'telegram':
            $tgToken  = Crypto::dec($conn['access_token']);
            $tgChatId = $msg['author_id'] ?? '';
            if ($tgToken && $tgChatId) {
                $ch = curl_init("https://api.telegram.org/bot{$tgToken}/sendMessage");
                curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_POST=>true,
                    CURLOPT_POSTFIELDS=>http_build_query(['chat_id'=>$tgChatId,'text'=>$text])]);
                curl_exec($ch); curl_close($ch);
            }
            break;
        case 'whatsapp':
        case 'whatsapp_channel':
        case 'whatsapp_broadcast':
            // Reply via WhatsApp Cloud API to the sender's phone number
            $waConn   = DB::one('SELECT * FROM platform_connections WHERE id=?', [$msg['connection_id']]);
            $waExtra  = json_decode($waConn['extra'] ?? '{}', true);
            $phoneId  = $waExtra['phone_number_id'] ?? $waConn['account_id'] ?? '';
            $waToken  = Crypto::dec($waConn['access_token']);
            $toNumber = $msg['author_id'] ?? '';
            // If author_id is empty, try to decode phone from wamid
            if (!$toNumber && !empty($msg['external_id'])) {
                $b64 = str_replace('wamid.', '', $msg['external_id']);
                $decoded = base64_decode($b64);
                if (preg_match('/(\d{10,15})/', $decoded, $m)) {
                    $toNumber = $m[1];
                }
            }
            // Strip any WhatsApp suffix (e.g. 1234567890@c.us -> 1234567890)
            $toNumber = preg_replace('/@.*$/', '', $toNumber);
            if ($phoneId && $waToken && $toNumber) {
                $ch = curl_init("https://graph.facebook.com/v19.0/{$phoneId}/messages");
                curl_setopt_array($ch,[
                    CURLOPT_RETURNTRANSFER=>true, CURLOPT_POST=>true,
                    CURLOPT_POSTFIELDS=>json_encode([
                        'messaging_product' => 'whatsapp',
                        'to'                => $toNumber,
                        'type'              => 'text',
                        'text'              => ['body' => $text],
                    ]),
                    CURLOPT_HTTPHEADER=>["Authorization: Bearer $waToken",'Content-Type: application/json'],
                ]);
                $r = json_decode(curl_exec($ch), true); curl_close($ch);
                if (!empty($r['error'])) {
                    throw new RuntimeException('WhatsApp reply failed: ' . ($r['error']['message'] ?? json_encode($r)));
                }
            } else {
                throw new RuntimeException('WhatsApp reply: missing phone_number_id, token, or recipient number');
            }
            break;
    }
    DB::update('social_inbox',['replied_at'=>date('Y-m-d H:i:s'),'reply_text'=>$text,'is_read'=>1],'id=?',[(int)$p['id']]);
    Response::ok(null, 'Reply sent');
});



// ── WhatsApp Incoming Webhook ─────────────────────────────────────────────
// GET: Meta verification handshake
$router->get('/whatsapp/webhook', function() {
    // PHP converts dots to underscores in query params
    $mode      = $_GET['hub_mode']          ?? $_GET['hub.mode']          ?? '';
    $token     = $_GET['hub_verify_token']  ?? $_GET['hub.verify_token']  ?? '';
    $challenge = $_GET['hub_challenge']     ?? $_GET['hub.challenge']     ?? '';
    $expected  = DB::one("SELECT value FROM settings WHERE key_name='whatsapp_verify_token'")['value'] ?? 'flowpost_wa_verify';
    if ($mode === 'subscribe' && $token === $expected) {
        http_response_code(200);
        echo $challenge;
        exit;
    }
    http_response_code(403);
    echo 'Forbidden';
    exit;
});

// POST: Receive incoming WhatsApp messages and store in social_inbox
$router->post('/whatsapp/webhook', function() {
    $raw  = file_get_contents('php://input');
    $data = json_decode($raw, true) ?? [];

    if (($data['object'] ?? '') !== 'whatsapp_business_account') {
        http_response_code(200); echo 'ok'; exit;
    }

    foreach ($data['entry'] ?? [] as $entry) {
        foreach ($entry['changes'] ?? [] as $change) {
            $value = $change['value'] ?? [];
            $phoneId = $value['metadata']['phone_number_id'] ?? '';

            // Find connection by account_id (phone number ID)
            $conn = DB::one("SELECT id FROM platform_connections WHERE account_id=? AND connected=1 LIMIT 1", [$phoneId]);
            $connId = $conn ? $conn['id'] : 35; // fallback to id 35

            foreach ($value['messages'] ?? [] as $msg) {
                $from    = $msg['from'] ?? '';
                $msgId   = $msg['id']   ?? '';
                $type    = $msg['type'] ?? 'text';
                $content = '';

                if ($type === 'text') {
                    $content = $msg['text']['body'] ?? '';
                } elseif ($type === 'image') {
                    $content = '[Image] ' . ($msg['image']['caption'] ?? '');
                } elseif ($type === 'audio') {
                    $content = '[Voice message]';
                } elseif ($type === 'video') {
                    $content = '[Video] ' . ($msg['video']['caption'] ?? '');
                } elseif ($type === 'document') {
                    $content = '[Document: ' . ($msg['document']['filename'] ?? 'file') . ']';
                } elseif ($type === 'location') {
                    $content = '[Location: ' . ($msg['location']['latitude'] ?? '') . ',' . ($msg['location']['longitude'] ?? '') . ']';
                } else {
                    $content = '[' . $type . ' message]';
                }

                // Get sender name from contacts if available
                $authorName = $from;
                foreach ($value['contacts'] ?? [] as $c) {
                    if ($c['wa_id'] === $from) {
                        $authorName = $c['profile']['name'] ?? $from;
                        break;
                    }
                }

                // Avoid duplicates
                $exists = DB::one("SELECT id FROM social_inbox WHERE external_id=?", [$msgId]);
                if ($exists) continue;

                // Insert into social_inbox
                $inboxId = DB::insert('social_inbox', [
                    'connection_id' => $connId,
                    'platform'      => 'whatsapp',
                    'message_type'  => 'dm',
                    'external_id'   => $msgId,
                    'author_id'     => $from,
                    'author_name'   => $authorName,
                    'author_pic'    => null,
                    'content'       => $content,
                    'post_url'      => null,
                    'post_id'       => null,
                    'is_read'       => 0,
                    'created_at'    => date('Y-m-d H:i:s'),
                ]);

                // Fire notification to all admin users
                $preview = strlen($content) > 60 ? substr($content, 0, 60) . '…' : $content;
                $admins  = DB::all("SELECT id FROM users WHERE role IN ('admin','owner') LIMIT 10", []);
                foreach ($admins as $admin) {
                    DB::insert('notifications', [
                        'user_id'    => $admin['id'],
                        'type'       => 'message',
                        'title'      => '💬 WhatsApp reply from ' . $authorName,
                        'message'    => $preview,
                        'icon'       => '💬',
                        'color'      => '#25D366',
                        'link'       => '/inbox',
                        'is_read'    => 0,
                    ]);
                }

                // Fire notification to all admin users
                $preview = strlen($content) > 60 ? substr($content, 0, 60) . '…' : $content;
                $admins  = DB::all("SELECT id FROM users WHERE role IN ('admin','owner') LIMIT 10", []);
                foreach ($admins as $admin) {
                    DB::insert('notifications', [
                        'user_id'    => $admin['id'],
                        'type'       => 'message',
                        'title'      => '💬 WhatsApp reply from ' . $authorName,
                        'message'    => $preview,
                        'icon'       => '💬',
                        'color'      => '#25D366',
                        'link'       => '/inbox',
                        'is_read'    => 0,
                    ]);
                }
            }
        }
    }

    http_response_code(200); echo 'ok'; exit;
});

$router->get('/inbox/sync', function() {
    Auth::requireRole('admin');
    $results = InboxFetcher::fetchAll();
    Response::ok(['synced'=>count($results),'details'=>$results]);
});

// INSIGHTS
$router->get('/insights/post/{id}', function(array $p) {
    Auth::require();
    $targets = DB::all('SELECT pt.*,pi.*,pl.name as platform_name,pl.key_name FROM post_targets pt LEFT JOIN post_insights pi ON pi.post_target_id=pt.id JOIN platforms pl ON pl.id=pt.platform_id WHERE pt.post_id=?', [(int)$p['id']]);
    Response::ok($targets);
});

$router->post('/insights/fetch/{target_id}', function(array $p) {
    Auth::requireRole('admin');
    $ok = InsightsFetcher::fetchForTarget((int)$p['target_id']);
    Response::ok(['fetched'=>$ok]);
});


// ── LINK SHORTENER ──────────────────────────────────────────────────────────
$router->post('/links/shorten', function() {
    $u = Auth::require();
    $b = body(); required($b, ['url']);
    $code = substr(base64_encode(random_bytes(6)), 0, 8);
    $code = str_replace(['+','/','='], ['a','b','c'], $code);
    $utmUrl = $b['url'];
    $utmParts = [];
    if (!empty($b['utm_source']))   $utmParts['utm_source']   = $b['utm_source'];
    if (!empty($b['utm_medium']))   $utmParts['utm_medium']   = $b['utm_medium'];
    if (!empty($b['utm_campaign'])) $utmParts['utm_campaign'] = $b['utm_campaign'];
    if ($utmParts) $utmUrl .= (str_contains($utmUrl,'?')?'&':'?') . http_build_query($utmParts);
    $id = DB::insert('short_links', [
        'code'=>$code, 'original'=>$utmUrl,
        'utm_source'=>$b['utm_source']??null, 'utm_medium'=>$b['utm_medium']??null,
        'utm_campaign'=>$b['utm_campaign']??null, 'created_by'=>$u['id'],
    ]);
    $shortUrl = rtrim(getenv('FP_APP_URL'),'/') . '/s/' . $code;
    Response::ok(['id'=>$id,'code'=>$code,'short_url'=>$shortUrl,'original'=>$utmUrl]);
});

$router->get('/links', function() {
    Auth::require();
    $links = DB::all('SELECT sl.*, u.name as creator FROM short_links sl LEFT JOIN users u ON u.id=sl.created_by ORDER BY sl.created_at DESC LIMIT 100');
    Response::ok($links);
});

$router->get('/links/{id}/clicks', function(array $p) {
    Auth::require();
    $clicks = DB::all('SELECT DATE(clicked_at) d, COUNT(*) n FROM short_link_clicks WHERE link_id=? GROUP BY DATE(clicked_at) ORDER BY d DESC LIMIT 30', [(int)$p['id']]);
    $total  = DB::count('SELECT COUNT(*) FROM short_link_clicks WHERE link_id=?', [(int)$p['id']]);
    Response::ok(['total'=>$total,'by_day'=>$clicks]);
});

// ── LINK REDIRECT (public, no auth) ─────────────────────────────────────────
$router->get('/s/{code}', function(array $p) {
    $link = DB::one('SELECT * FROM short_links WHERE code=?', [$p['code']]);
    if (!$link) { http_response_code(404); echo 'Not found'; exit; }
    DB::insert('short_link_clicks', [
        'link_id'=>$link['id'],
        'ip'=>$_SERVER['REMOTE_ADDR']??null,
        'referrer'=>$_SERVER['HTTP_REFERER']??null,
    ]);
    DB::update('short_links',['clicks'=>(int)$link['clicks']+1],'id=?',[$link['id']]);
    header('Location: '.$link['original']); exit;
});

// ── BEST TIME TO POST ────────────────────────────────────────────────────────
$router->get('/analytics/best-times', function() {
    Auth::require();
    $days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    // Check if we have meaningful engagement data (sum > 0)
    $engSum = (int)(DB::one("
        SELECT COALESCE(SUM(pi.likes + pi.comments_count + pi.shares + pi.saves + pi.engagement),0) as total
        FROM post_insights pi
        JOIN post_targets pt ON pt.id=pi.post_target_id
        JOIN posts p ON p.id=pt.post_id
        WHERE p.scheduled_at IS NOT NULL")['total'] ?? 0);

    $mode = 'frequency';
    $byHour = [];
    $byDay  = [];

    if ($engSum > 10) {
        $mode = 'engagement';
        $byHour = DB::all("
            SELECT HOUR(p.scheduled_at) h,
                   ROUND(AVG(pi.likes + pi.comments_count + pi.shares + pi.saves + pi.engagement),1) n,
                   COUNT(*) posts
            FROM post_insights pi
            JOIN post_targets pt ON pt.id=pi.post_target_id
            JOIN posts p ON p.id=pt.post_id
            WHERE p.scheduled_at IS NOT NULL
            GROUP BY HOUR(p.scheduled_at) ORDER BY n DESC");

        $byDayRaw = DB::all("
            SELECT DAYOFWEEK(p.scheduled_at) d,
                   ROUND(AVG(pi.likes + pi.comments_count + pi.shares + pi.saves + pi.engagement),1) n,
                   COUNT(*) posts
            FROM post_insights pi
            JOIN post_targets pt ON pt.id=pi.post_target_id
            JOIN posts p ON p.id=pt.post_id
            WHERE p.scheduled_at IS NOT NULL
            GROUP BY DAYOFWEEK(p.scheduled_at) ORDER BY n DESC");
        $byDay = array_map(fn($r)=>['day'=>$days[$r['d']-1],'n'=>$r['n'],'posts'=>$r['posts']], $byDayRaw);
    } else {
        $byHour = DB::all("SELECT HOUR(scheduled_at) h, COUNT(*) n FROM posts WHERE status='published' AND scheduled_at IS NOT NULL GROUP BY h ORDER BY n DESC");
        $byDayRaw = DB::all("SELECT DAYOFWEEK(scheduled_at) d, COUNT(*) n FROM posts WHERE status='published' AND scheduled_at IS NOT NULL GROUP BY d ORDER BY n DESC");
        $byDay = array_map(fn($r)=>['day'=>$days[$r['d']-1],'n'=>$r['n']], $byDayRaw);
    }

    Response::ok(['by_hour'=>$byHour,'by_day'=>$byDay,'mode'=>$mode,'engagement_total'=>$engSum]);
});



// ── FIRST COMMENT ────────────────────────────────────────────────────────────
// Stored as part of post extra field; dispatched by publisher after posting
$router->post('/posts/{id}/first-comment', function(array $p) {
    Auth::require();
    $b = body();
    $post = PostModel::get((int)$p['id']);
    DB::update('posts',['first_comment'=>$b['comment']??null],'id=?',[(int)$p['id']]);
    Response::ok(null,'First comment saved');
});

// ── CAMPAIGNS ────────────────────────────────────────────────────────────────
$router->get('/campaigns', function() {
    Auth::require();
    Response::ok(DB::all("SELECT c.*, COUNT(p.id) post_count FROM campaigns c LEFT JOIN posts p ON p.campaign_id=c.id GROUP BY c.id ORDER BY c.created_at DESC"));
});
$router->post('/campaigns', function() {
    Auth::requireRole('admin','editor');
    $b = body(); required($b,['name']);
    $id = DB::insert('campaigns',['name'=>$b['name'],'description'=>$b['description']??null,'color'=>$b['color']??'#6366f1','start_date'=>$b['start_date']??null,'end_date'=>$b['end_date']??null,'site_id'=>$b['site_id']??null]);
    Response::ok(['id'=>$id],'Campaign created');
});
$router->put('/campaigns/{id}', function(array $p) {
    Auth::requireRole('admin','editor');
    $b=body(); $f=array_intersect_key($b,array_flip(['name','description','color','start_date','end_date','site_id']));
    if($f) DB::update('campaigns',$f,'id=?',[(int)$p['id']]);
    Response::ok(null,'Updated');
});
$router->delete('/campaigns/{id}', function(array $p) {
    Auth::requireRole('admin','editor');
    DB::run('DELETE FROM campaigns WHERE id=?',[(int)$p['id']]);
    Response::ok(null,'Deleted');
});


// ── WATERMARK ────────────────────────────────────────────────────────────────
$router->post('/media/watermark', function() {
    Auth::require();
    $b = body();
    $imageUrl   = $b['image_url']   ?? '';
    $logoUrl    = $b['logo_url']    ?? '';
    $position   = $b['position']    ?? 'bottom-right'; // top-left, top-right, bottom-left, bottom-right, center
    $opacity    = min(100, max(10, (int)($b['opacity'] ?? 70)));
    $scale      = min(50, max(5, (int)($b['scale'] ?? 20))); // % of image width

    if (!$imageUrl) throw new ValidationException('image_url is required');

    // Download image
    $imgData = @file_get_contents($imageUrl);
    if (!$imgData) throw new RuntimeException('Could not fetch image');

    $img = @imagecreatefromstring($imgData);
    if (!$img) throw new RuntimeException('Invalid image format');

    $iw = imagesx($img); $ih = imagesy($img);

    // Apply watermark text if no logo provided
    if (!$logoUrl) {
        // Text watermark fallback
        $color = imagecolorallocatealpha($img, 255, 255, 255, (int)(127 * (1 - $opacity/100)));
        $font  = 5; $text = getenv('APP_NAME') ?: 'FlowPost';
        $tw    = imagefontwidth($font) * strlen($text);
        $th    = imagefontheight($font);
        [$x,$y] = self::watermarkPosition($position,$iw,$ih,$tw,$th,20);
        imagestring($img, $font, $x, $y, $text, $color);
    } else {
        // Logo watermark
        $logoData = @file_get_contents($logoUrl);
        if ($logoData) {
            $logo = @imagecreatefromstring($logoData);
            if ($logo) {
                $lw = imagesx($logo); $lh = imagesy($logo);
                $newLw = (int)($iw * $scale / 100);
                $newLh = (int)($lh * $newLw / $lw);
                $resized = imagescale($logo, $newLw, $newLh);
                imagealphablending($img, true);
                [$x,$y] = watermarkPos($position,$iw,$ih,$newLw,$newLh,20);
                imagecopymerge($img, $resized, $x, $y, 0, 0, $newLw, $newLh, $opacity);
                imagedestroy($logo); imagedestroy($resized);
            }
        }
    }

    // Output as base64
    ob_start();
    imagepng($img);
    $out = ob_get_clean();
    imagedestroy($img);
    Response::ok(['image_base64' => 'data:image/png;base64,' . base64_encode($out)]);
});

function watermarkPos(string $pos, int $iw, int $ih, int $ww, int $wh, int $pad): array {
    return match($pos) {
        'top-left'     => [$pad, $pad],
        'top-right'    => [$iw-$ww-$pad, $pad],
        'bottom-left'  => [$pad, $ih-$wh-$pad],
        'center'       => [(int)(($iw-$ww)/2), (int)(($ih-$wh)/2)],
        default        => [$iw-$ww-$pad, $ih-$wh-$pad], // bottom-right
    };
}


// ── WhatsApp contacts ─────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════
// CONTACT SEGMENTS
// ═══════════════════════════════════════════════════════════════

$router->get('/whatsapp/segments', function() {
    Auth::require();
    $siteId = (int)($_GET['site_id'] ?? 0);
    if (!$siteId) Response::json(['error' => 'site_id required'], 400);
    Response::ok(DB::all(
        'SELECT cs.*, COUNT(sc.id) as contact_count
         FROM contact_segments cs
         LEFT JOIN sms_contacts sc ON sc.segment_id=cs.id AND sc.active=1
         WHERE cs.site_id=?
         GROUP BY cs.id
         ORDER BY cs.name',
        [$siteId]
    ));
});

$router->post('/whatsapp/segments', function() {
    Auth::require();
    $b = body();
    required($b, ['site_id', 'name']);
    $id = DB::insert('contact_segments', [
        'site_id'     => (int)$b['site_id'],
        'name'        => trim($b['name']),
        'description' => $b['description'] ?? null,
    ]);
    Response::ok(['id' => $id], 'Segment created');
});

$router->put('/whatsapp/segments/{id}', function(array $p) {
    Auth::require();
    $b = body();
    DB::update('contact_segments',
        ['name' => trim($b['name']), 'description' => $b['description'] ?? null],
        'id=?', [(int)$p['id']]
    );
    Response::ok([], 'Segment updated');
});

$router->delete('/whatsapp/segments/{id}', function(array $p) {
    Auth::require();
    $segId = (int)$p['id'];
    DB::update('sms_contacts', ['segment_id' => null], 'segment_id=?', [$segId]);
    DB::run('DELETE FROM contact_segments WHERE id=?', [$segId]);
    Response::ok([], 'Segment deleted, contacts unassigned');
});

// ═══════════════════════════════════════════════════════════════
// CONTACTS (site-level, not connection-level)
// ═══════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════
// CONTACT SEGMENTS
// ═══════════════════════════════════════════════════════════════





// ═══════════════════════════════════════════════════════════════
// CONTACTS (site-level, not connection-level)
// ═══════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════
// CONTACT SEGMENTS
// ═══════════════════════════════════════════════════════════════





// ═══════════════════════════════════════════════════════════════
// CONTACTS (site-level, not connection-level)
// ═══════════════════════════════════════════════════════════════

$router->get('/whatsapp/contacts', function() {
    Auth::require();
    $siteId    = (int)($_GET['site_id'] ?? 0);
    $segmentId = isset($_GET['segment_id']) ? (int)$_GET['segment_id'] : null;
    $search    = $_GET['search'] ?? '';
    if (!$siteId) Response::json(['error' => 'site_id required'], 400);
    $where  = 'sc.site_id=? AND sc.active=1';
    $params = [$siteId];
    if ($segmentId) { $where .= ' AND sc.segment_id=?'; $params[] = $segmentId; }
    if ($search) { $where .= ' AND (sc.name LIKE ? OR sc.phone LIKE ?)'; $params[] = "%$search%"; $params[] = "%$search%"; }
    Response::ok(DB::all(
        "SELECT sc.id, sc.name, sc.phone, sc.segment_id, sc.created_at, cs.name as segment_name
         FROM sms_contacts sc
         LEFT JOIN contact_segments cs ON cs.id=sc.segment_id
         WHERE $where ORDER BY sc.name, sc.phone",
        $params
    ));
});

$router->post('/whatsapp/contacts', function() {
    Auth::require();
    $b = body();
    required($b, ['site_id', 'phone']);
    $phone = preg_replace('/[^+\d]/', '', $b['phone']);
    if (strlen($phone) < 7) Response::json(['error' => 'Invalid phone number'], 400);
    $existing = DB::one('SELECT id FROM sms_contacts WHERE site_id=? AND phone=? AND active=1', [(int)$b['site_id'], $phone]);
    if ($existing) Response::json(['error' => 'Contact already exists'], 409);
    $id = DB::insert('sms_contacts', [
        'site_id'    => (int)$b['site_id'],
        'segment_id' => isset($b['segment_id']) ? (int)$b['segment_id'] : null,
        'name'       => $b['name'] ?? null,
        'phone'      => $phone,
    ]);
    Response::ok(['id' => $id], 'Contact added');
});

$router->post('/whatsapp/contacts/import', function() {
    Auth::require();
    $b = body();
    required($b, ['site_id', 'contacts']);
    $siteId = (int)$b['site_id'];
    $segmentId = isset($b['segment_id']) ? (int)$b['segment_id'] : null;
    $added = 0; $dupes = 0;
    foreach ((array)$b['contacts'] as $c) {
        $phone = preg_replace('/[^+\d]/', '', is_array($c) ? ($c['phone'] ?? '') : $c);
        if (strlen($phone) < 7) continue;
        $existing = DB::one('SELECT id FROM sms_contacts WHERE site_id=? AND phone=? AND active=1', [$siteId, $phone]);
        if ($existing) { $dupes++; continue; }
        DB::insert('sms_contacts', ['site_id' => $siteId, 'segment_id' => $segmentId, 'name' => is_array($c) ? ($c['name'] ?? null) : null, 'phone' => $phone]);
        $added++;
    }
    Response::ok(['added' => $added, 'duplicates' => $dupes], "$added contacts imported, $dupes duplicates skipped");
});

$router->put('/whatsapp/contacts/{id}', function(array $p) {
    Auth::require();
    $b = body(); $updates = [];
    if (isset($b['name']))       $updates['name']       = $b['name'];
    if (isset($b['segment_id'])) $updates['segment_id'] = (int)$b['segment_id'] ?: null;
    if (empty($updates)) Response::json(['error' => 'Nothing to update'], 400);
    DB::update('sms_contacts', $updates, 'id=?', [(int)$p['id']]);
    Response::ok([], 'Contact updated');
});

$router->post('/whatsapp/contacts/{id}/segment', function(array $p) {
    Auth::require();
    $b = body();
    DB::update('sms_contacts', ['segment_id' => isset($b['segment_id']) ? (int)$b['segment_id'] : null], 'id=?', [(int)$p['id']]);
    Response::ok([], 'Segment assigned');
});

$router->delete('/whatsapp/contacts/{id}', function(array $p) {
    Auth::require();
    DB::update('sms_contacts', ['active' => 0], 'id=?', [(int)$p['id']]);
    Response::ok([], 'Contact deleted');
});

$router->post('/whatsapp/contacts/bulk-delete', function() {
    Auth::require();
    $b = body(); required($b, ['ids']);
    $ids = array_map('intval', (array)$b['ids']);
    if (empty($ids)) Response::json(['error' => 'No IDs provided'], 400);
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    DB::run("UPDATE sms_contacts SET active=0 WHERE id IN ($placeholders)", $ids);
    Response::ok(['deleted' => count($ids)], count($ids) . ' contacts deleted');
});

$router->post('/whatsapp/contacts/bulk-segment', function() {
    Auth::require();
    $b = body(); required($b, ['ids', 'segment_id']);
    $ids = array_map('intval', (array)$b['ids']);
    $segmentId = (int)$b['segment_id'] ?: null;
    if (empty($ids)) Response::json(['error' => 'No IDs provided'], 400);
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    DB::run("UPDATE sms_contacts SET segment_id=? WHERE id IN ($placeholders)", array_merge([$segmentId], $ids));
    Response::ok(['updated' => count($ids)], count($ids) . ' contacts updated');
});









// WhatsApp test message
$router->post('/whatsapp/test', function() {
    Auth::require();
    $b = body(); required($b,['connection_id','message']);
    $conn = DB::one('SELECT * FROM platform_connections WHERE id=?',[(int)$b['connection_id']]);
    if (!$conn) throw new NotFoundException('Connection not found');
    $token   = Crypto::dec($conn['access_token']);
    $phoneId = $conn['account_id'];
    $siteId  = $conn['site_id'];
    $segId   = isset($b['segment_id']) && $b['segment_id'] ? (int)$b['segment_id'] : null;
    $to      = $b['to'] ?? null;

    // Segment send — send to all contacts in segment
    if ($segId && !$to) {
        if ($segId === -1) {
            $recipients = DB::all('SELECT phone FROM sms_contacts WHERE site_id=? AND active=1', [$siteId]);
        } else {
            $recipients = DB::all('SELECT phone FROM sms_contacts WHERE site_id=? AND segment_id=? AND active=1', [$siteId, $segId]);
        }
        if (empty($recipients)) Response::json(['error'=>'No contacts in this segment'],400);
        $sent = 0;
        foreach ($recipients as $r) {
            $payload = ['messaging_product'=>'whatsapp','recipient_type'=>'individual','to'=>$r['phone'],'type'=>'text','text'=>['body'=>$b['message']]];
            $ch=curl_init("https://graph.facebook.com/v19.0/{$phoneId}/messages");
            curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($payload),
                CURLOPT_HTTPHEADER=>["Authorization: Bearer {$token}",'Content-Type: application/json']]);
            $res=json_decode(curl_exec($ch),true);curl_close($ch);
            if(isset($res['messages'])) $sent++;
        }
        Response::ok(['sent_to'=>$sent], "WhatsApp sent to {$sent} contacts!");
    }

    // Single number send
    if (!$to) Response::json(['error'=>'Provide either to (phone number) or segment_id'],400);
    $payload = ['messaging_product'=>'whatsapp','recipient_type'=>'individual','to'=>$to,'type'=>'text','text'=>['body'=>$b['message']]];
    $ch=curl_init("https://graph.facebook.com/v19.0/{$phoneId}/messages");
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($payload),
        CURLOPT_HTTPHEADER=>["Authorization: Bearer {$token}",'Content-Type: application/json']]);
    $r=json_decode(curl_exec($ch),true);curl_close($ch);
    if(isset($r['messages'])) Response::ok(['sent_to'=>1],'WhatsApp message sent! Check your WhatsApp.');
    elseif(isset($r['error'])) Response::json(['error'=>$r['error']['message']??'WhatsApp API error','code'=>$r['error']['code']??0,'tip'=>$r['error']['code']==131030?'Add this number to your Meta test recipients list: developers.facebook.com → WhatsApp → API Setup → Manage phone number list':''],400);
    else Response::json(['error'=>'Unknown WhatsApp error','raw'=>$r],500);
});


// Update .env credential (admin only)
$router->post('/settings/env', function() {
    Auth::requireRole('admin');
    $b = body(); required($b, ['key','value']);
    $allowedKeys = ['LINKEDIN_CLIENT_ID','LINKEDIN_CLIENT_SECRET','TIKTOK_CLIENT_ID','TIKTOK_CLIENT_SECRET',
        'PINTEREST_CLIENT_ID','PINTEREST_CLIENT_SECRET',
        'META_WABA_PHONE_ID','YOUTUBE_CLIENT_ID','YOUTUBE_CLIENT_SECRET'];
    if (!in_array($b['key'], $allowedKeys)) throw new ValidationException('Key not allowed');
    $envFile = __DIR__ . '/../.env';
    $content = file_get_contents($envFile);
    $key     = preg_quote($b['key'], '/');
    $val     = $b['value'];
    if (preg_match("/^{$key}=/m", $content)) {
        $content = preg_replace("/^{$key}=.*/m", $b['key'] . '=' . $val, $content);
    } else {
        $content .= "
" . $b['key'] . '=' . $val;
    }
    file_put_contents($envFile, $content);
    putenv($b['key'] . '=' . $val);
    Response::ok(null, 'Saved');
});





// -- TO-DO LIST
$router->get('/todos', function() {
    Auth::require();
    $u = Auth::user();
    $category = param('category_id');
    $where = ['t.site_id=?']; $params = [(int)($u['site_id']??1)];
    if ($category) { $where[] = 't.category_id=?'; $params[] = (int)$category; }
    $w = implode(' AND ', $where);
    $todos = DB::all("SELECT t.*, c.name as category_name, c.color as category_color,
                      u.name as author_name, a.name as assigned_name
                      FROM todos t
                      LEFT JOIN todo_categories c ON c.id=t.category_id
                      LEFT JOIN users u ON u.id=t.author_id
                      LEFT JOIN users a ON a.id=t.assigned_to
                      WHERE $w ORDER BY FIELD(t.priority,'urgent','high','medium','low'), t.due_date ASC, t.created_at DESC", $params);
    Response::ok($todos);
});
$router->post('/todos', function() {
    Auth::require(); $u = Auth::user(); $b = body(); required($b, ['title']);
    $id = DB::insert('todos', [
        'site_id'     => (int)($u['site_id']??1), 'author_id' => (int)$u['id'],
        'assigned_to' => !empty($b['assigned_to']) ? (int)$b['assigned_to'] : null,
        'category_id' => !empty($b['category_id']) ? (int)$b['category_id'] : null,
        'title'       => trim($b['title']), 'notes' => $b['notes'] ?? null,
        'status'      => $b['status'] ?? 'todo', 'priority' => $b['priority'] ?? 'medium',
        'due_date'    => !empty($b['due_date']) ? $b['due_date'] : null,
        'recurring'   => $b['recurring'] ?? 'none',
    ]);
    Response::ok(DB::one('SELECT * FROM todos WHERE id=?',[$id]), 'Task created');
});
$router->put('/todos/{id}', function(array $p) {
    Auth::require(); $b = body(); $fields = [];
    if (isset($b['title']))       $fields['title']       = trim($b['title']);
    if (isset($b['notes']))       $fields['notes']       = $b['notes'];
    if (isset($b['status']))      $fields['status']      = $b['status'];
    if (isset($b['priority']))    $fields['priority']    = $b['priority'];
    if (isset($b['category_id'])) $fields['category_id'] = !empty($b['category_id']) ? (int)$b['category_id'] : null;
    if (isset($b['assigned_to'])) $fields['assigned_to'] = !empty($b['assigned_to']) ? (int)$b['assigned_to'] : null;
    if (isset($b['due_date']))    $fields['due_date']    = !empty($b['due_date']) ? $b['due_date'] : null;
    if (isset($b['recurring']))   $fields['recurring']   = $b['recurring'];
    if (isset($b['status']) && $b['status']==='done') $fields['completed_at'] = date('Y-m-d H:i:s');
    if (isset($b['status']) && $b['status']!=='done') $fields['completed_at'] = null;
    if ($fields) DB::update('todos', $fields, 'id=?', [(int)$p['id']]);
    Response::ok(null, 'Task updated');
});
$router->delete('/todos/{id}', function(array $p) {
    Auth::require();
    DB::run('DELETE FROM todos WHERE id=?', [(int)$p['id']]);
    Response::ok(null, 'Task deleted');
});
$router->post('/todos/bulk-delete', function() {
    Auth::require();
    $ids = array_map('intval', (array)(body()['ids'] ?? []));
    if (!$ids) Response::json(['error' => 'No ids'], 400);
    $ph = implode(',', array_fill(0, count($ids), '?'));
    DB::run("DELETE FROM todos WHERE id IN($ph)", $ids);
    Response::ok(['deleted' => count($ids)]);
});
$router->get('/todo-categories', function() {
    Auth::require();
    Response::ok(DB::all('SELECT * FROM todo_categories ORDER BY sort_order'));
});



// ── SOCIAL LISTENING ─────────────────────────────────────────────────────────
$router->get('/listening/mentions', function() {
    Auth::require();
    $kw = param('keyword'); $platform = param('platform');
    $unread = param('unread');
    $where = ['1=1']; $params = [];
    if ($kw) { $where[]='keyword=?'; $params[]=$kw; }
    if ($platform) { $where[]='platform=?'; $params[]=$platform; }
    if ($unread==='1') { $where[]='is_read=0'; }
    $w = implode(' AND ',$where);
    Response::ok(DB::all("SELECT * FROM social_mentions WHERE $w ORDER BY created_at DESC LIMIT 100", $params));
});

$router->get('/listening/keywords', function() {
    Auth::require();
    Response::ok(DB::all('SELECT * FROM listening_keywords WHERE active=1 ORDER BY keyword'));
});

$router->post('/listening/keywords', function() {
    Auth::requireRole('admin','editor');
    $b = body(); required($b,['keyword']);
    $id = DB::insert('listening_keywords',['keyword'=>strtolower(trim($b['keyword'])),'platforms'=>$b['platforms']??'all']);
    Response::ok(['id'=>$id],'Keyword added');
});

$router->delete('/listening/keywords/{id}', function(array $p) {
    Auth::requireRole('admin','editor');
    DB::update('listening_keywords',['active'=>0],'id=?',[(int)$p['id']]);
    Response::ok(null,'Removed');
});

$router->post('/listening/mentions/{id}/read', function(array $p) {
    Auth::require();
    DB::update('social_mentions',['is_read'=>1],'id=?',[(int)$p['id']]);
    Response::ok(null,'Marked read');
});

$router->get('/listening/search', function() {
    Auth::require();
    $q = param('q','');
    if (!$q) Response::json(['error'=>'Query required'],400);

    $results = [];
    // Search Facebook (if connected)
    $fbConns = DB::all("SELECT pc.access_token FROM platform_connections pc JOIN platforms pl ON pl.id=pc.platform_id WHERE pl.key_name='facebook' AND pc.connected=1 LIMIT 1");
    if (!empty($fbConns)) {
        $token = Crypto::dec($fbConns[0]['access_token']);
        $r = @file_get_contents("https://graph.facebook.com/v19.0/search?q=".urlencode($q)."&type=post&access_token={$token}");
        if ($r) {
            $d = json_decode($r,true);
            foreach (($d['data']??[]) as $item) {
                $results[] = ['platform'=>'facebook','content'=>$item['message']??'','url'=>'https://facebook.com/'.$item['id'],'author'=>$item['from']['name']??'Unknown','created_at'=>$item['created_time']??date('Y-m-d H:i:s')];
            }
        }
    }
    // Save to mentions
    foreach ($results as $r) {
        try { DB::insert('social_mentions',['platform'=>$r['platform'],'keyword'=>$q,'author_name'=>$r['author'],'content'=>$r['content'],'url'=>$r['url'],'created_at'=>$r['created_at']??date('Y-m-d H:i:s')]); } catch(\Throwable $e){}
    }
    Response::ok(['results'=>$results,'query'=>$q,'count'=>count($results)]);
});

// ── TWITTER/X THREADS ────────────────────────────────────────────────────────
$router->post('/posts/{id}/thread', function(array $p) {
    Auth::require();
    $b = body(); // tweets = array of text strings
    $tweets = $b['tweets'] ?? [];
    if (empty($tweets)) throw new ValidationException('No tweets provided');
    // Store as post notes with thread marker
    $threadJson = json_encode($tweets);
    DB::update('posts',['notes'=>'__thread__:'.$threadJson],'id=?',[(int)$p['id']]);
    Response::ok(null,'Thread saved — will post as sequence when published');
});

// ── GOOGLE ANALYTICS ─────────────────────────────────────────────────────────
$router->post('/sites/{id}/analytics', function(array $p) {
    Auth::requireRole('admin');
    $b = body();
    DB::update('sites',['ga_property_id'=>$b['ga_property_id']??null,'ga_measurement_id'=>$b['ga_measurement_id']??null],'id=?',[(int)$p['id']]);
    Response::ok(null,'GA settings saved');
});


// ── GOOGLE ANALYTICS OAUTH ───────────────────────────────────────────────────
$router->get('/oauth/ga/start', function() {
    $siteId = $_GET['site_id'] ?? '1';
    $state  = base64_encode(json_encode(['site_id'=>$siteId,'csrf'=>bin2hex(random_bytes(8))]));
    header('Location: ' . GAOAuth::authUrl($state)); exit;
});

$router->get('/oauth/ga/callback', function() {
    $code = $_GET['code'] ?? ''; $state = $_GET['state'] ?? ''; $err = $_GET['error'] ?? '';
    if ($err || !$code) { header('Location: /?oauth_error='.urlencode($err?:'no_code')); exit; }
    $sd     = json_decode(base64_decode($state), true) ?? [];
    $siteId = (int)($sd['site_id'] ?? 1);
    try {
        $tok     = GAOAuth::exchangeCode($code);
        $access  = $tok['access_token'];
        $refresh = $tok['refresh_token'] ?? null;
        $expiry  = date('Y-m-d H:i:s', time() + ($tok['expires_in'] ?? 3600));
        $props   = GAOAuth::listProperties($access);
        // Store token — property selection happens in UI
        $ex = DB::one('SELECT id FROM ga_tokens WHERE site_id=?', [$siteId]);
        $data = ['site_id'=>$siteId,'property_id'=>$props[0]['id']??'','access_token'=>Crypto::enc($access),'refresh_token'=>$refresh?Crypto::enc($refresh):null,'expires_at'=>$expiry];
        if ($ex) DB::update('ga_tokens',$data,'id=?',[$ex['id']]);
        else     DB::insert('ga_tokens',$data);
        header('Location: /?oauth_success=ga&connected=1'); exit;
    } catch (Exception $e) { header('Location: /?oauth_error='.urlencode($e->getMessage())); exit; }
});

// ── GOOGLE ANALYTICS DATA ─────────────────────────────────────────────────────
$router->get('/analytics/ga/properties', function() {
    Auth::require();
    $siteId = param('site_id',1);
    $row = DB::one('SELECT * FROM ga_tokens WHERE site_id=?', [(int)$siteId]);
    if (!$row) Response::json(['error'=>'GA not connected for this site'],404);
    $token = Crypto::dec($row['access_token']);
    // Refresh if needed
    if ($row['expires_at'] && strtotime($row['expires_at']) < time()+60 && $row['refresh_token']) {
        $new = GAOAuth::refreshToken(Crypto::dec($row['refresh_token']));
        if (!empty($new['access_token'])) {
            $token = $new['access_token'];
            DB::update('ga_tokens',['access_token'=>Crypto::enc($token),'expires_at'=>date('Y-m-d H:i:s',time()+($new['expires_in']??3600))],'id=?',[$row['id']]);
        }
    }
    $props = GAOAuth::listProperties($token);
    Response::ok($props);
});

$router->post('/analytics/ga/property', function() {
    Auth::require();
    $b = body();
    DB::update('ga_tokens',['property_id'=>$b['property_id']],'site_id=?',[(int)($b['site_id']??1)]);
    Response::ok(null,'Property saved');
});

$router->get('/analytics/ga/report', function() {
    Auth::require();
    $siteId = param('site_id',1);
    $days   = max(1,min(365,(int)param('days',30)));
    $row = DB::one('SELECT * FROM ga_tokens WHERE site_id=?', [(int)$siteId]);
    if (!$row || !$row['property_id']) Response::json(['error'=>'GA not connected or no property selected'],404);
    $token = Crypto::dec($row['access_token']);
    if ($row['expires_at'] && strtotime($row['expires_at']) < time()+60 && $row['refresh_token']) {
        $new = GAOAuth::refreshToken(Crypto::dec($row['refresh_token']));
        if (!empty($new['access_token'])) { $token=$new['access_token']; DB::update('ga_tokens',['access_token'=>Crypto::enc($token)],'id=?',[$row['id']]); }
    }
    $propId = $row['property_id'];
    $startDate = date('Y-m-d', strtotime("-{$days} days"));
    // Overview metrics
    $overview = GAOAuth::runReport($token,$propId,['sessions','activeUsers','pageviews','bounceRate','averageSessionDuration'],[],  $startDate,'today');
    // By page
    $byPage = GAOAuth::runReport($token,$propId,['sessions','pageviews'],['pagePath'],$startDate,'today');
    // By source
    $bySource = GAOAuth::runReport($token,$propId,['sessions'],['sessionDefaultChannelGroup'],$startDate,'today');
    // Daily sessions
    $daily = GAOAuth::runReport($token,$propId,['sessions'],['date'],$startDate,'today');
    Response::ok(['overview'=>$overview,'by_page'=>$byPage,'by_source'=>$bySource,'daily'=>$daily,'property_id'=>$propId,'days'=>$days]);
});

$router->get('/analytics/ga/status', function() {
    Auth::require();
    $siteId = param('site_id',1);
    $row = DB::one('SELECT site_id, property_id, expires_at FROM ga_tokens WHERE site_id=?', [(int)$siteId]);
    Response::ok(['connected'=>!!$row,'property_id'=>$row['property_id']??null,'expires_at'=>$row['expires_at']??null]);
});


// ── ELEVENLABS TTS ───────────────────────────────────────────────────────────
$router->post('/ai/elevenlabs-tts', function() {
    Auth::require();
    $b = body();
    $text    = $b['text'] ?? '';
    $voiceId = $b['voice_id'] ?? getenv('ELEVENLABS_VOICE_ID') ?: '21m00Tcm4TlvDq8ikWAM';
    $apiKey  = getenv('ELEVENLABS_API_KEY') ?: '';
    if (!$apiKey) throw new ValidationException('ElevenLabs API key not set in Settings');
    if (!$text)   throw new ValidationException('Text is required');

    $ch = curl_init("https://api.elevenlabs.io/v1/text-to-speech/{$voiceId}");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode([
            'text'           => substr($text, 0, 20000),
            'model_id'       => 'eleven_multilingual_v2',
            'voice_settings'  => ['stability'=>0.5, 'similarity_boost'=>0.75],
        ]),
        CURLOPT_HTTPHEADER => ["xi-api-key: {$apiKey}", 'Content-Type: application/json', 'Accept: audio/mpeg'],
        CURLOPT_TIMEOUT => 30,
    ]);
    $audio = curl_exec($ch);
    $code  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($code !== 200 || !$audio) throw new RuntimeException('ElevenLabs generation failed (HTTP '.$code.')');

    // Save to storage and media library
    $filename = 'el_voice_'.time().'.mp3';
    $dir = STORAGE_PATH . '/media/';
    @mkdir($dir, 0775, true);
    file_put_contents($dir . $filename, $audio);
    $url = rtrim(getenv('FP_APP_URL'),'/') . '/storage/media/' . $filename;
    $u = Auth::require();
    $mediaId = DB::insert('media',['site_id'=>null,'uploader_id'=>$u['id'],'filename'=>$filename,'path'=>$dir.$filename,'url'=>$url,'mime_type'=>'audio/mpeg','size'=>strlen($audio),'alt_text'=>'AI Voice — '.(substr($b['text']??'',0,50))]);
    Response::ok(['url' => $url, 'media_id' => $mediaId, 'provider' => 'elevenlabs']);
});

// ── RUNWAY VIDEO ──────────────────────────────────────────────────────────────
$router->post('/ai/runway-video', function() {
    Auth::require();
    $b = body();
    $prompt = $b['prompt'] ?? '';
    $apiKey = getenv('RUNWAY_API_KEY') ?: '';
    if (!$apiKey) throw new ValidationException('Runway API key not set');
    if (!$prompt) throw new ValidationException('Prompt required');

    // Runway Gen-3 Alpha Turbo
    $ch = curl_init('https://api.dev.runwayml.com/v1/image_to_video');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode([
            'model'        => 'gen3a_turbo',
            'promptText'   => substr($prompt, 0, 512),
            'duration'     => (int)($b['duration'] ?? 5),
            'ratio'        => '1280:768',
        ]),
        CURLOPT_HTTPHEADER => ["Authorization: Bearer {$apiKey}", 'Content-Type: application/json', 'X-Runway-Version: 2024-11-06'],
        CURLOPT_TIMEOUT => 30,
    ]);
    $r = json_decode(curl_exec($ch), true); curl_close($ch);
    if (isset($r['id'])) Response::ok(['task_id'=>$r['id'],'provider'=>'runway']);
    else throw new RuntimeException('Runway error: ' . json_encode($r));
});


// ── CANVA OAUTH ───────────────────────────────────────────────────────────────
$router->get('/oauth/canva/start', function() {
    $verifier = CanvaOAuth::generateVerifier();
    $state    = bin2hex(random_bytes(8));
    // Store verifier in a signed cookie instead of session
    setcookie('cv', base64_encode($verifier), time()+600, '/', '', true, true);
    header('Location: ' . CanvaOAuth::authUrl($verifier, $state)); exit;
});

$router->get('/oauth/canva/callback', function() {
    $code  = $_GET['code']  ?? '';
    $err   = $_GET['error'] ?? '';
    if ($err || !$code) { header('Location: /?oauth_error='.urlencode($err?:'no_code')); exit; }
    $verifier = isset($_COOKIE['cv']) ? base64_decode($_COOKIE['cv']) : '';
    try {
        $tok     = CanvaOAuth::exchangeCode($code, $verifier);
        $token   = $tok['access_token'];
        $refresh = $tok['refresh_token'] ?? null;
        $expiry  = date('Y-m-d H:i:s', time() + ($tok['expires_in'] ?? 3600));
        $profile = CanvaOAuth::getProfile($token);
        $name    = $profile['profile']['display_name'] ?? 'Canva User';
        // Try to get user from session - fallback to user 1 (admin)
        try { $user = Auth::require(); } catch(\Throwable $e) { $user = DB::one('SELECT * FROM users WHERE role="admin" LIMIT 1'); }
        if (!$user) { header('Location: /?oauth_error=not_logged_in'); exit; }
        $ex = DB::one('SELECT id FROM canva_tokens WHERE user_id=?', [$user['id']]);
        $data = ['user_id'=>$user['id'],'access_token'=>Crypto::enc($token),'refresh_token'=>$refresh?Crypto::enc($refresh):null,'expires_at'=>$expiry,'profile_name'=>$name];
        if ($ex) DB::update('canva_tokens',$data,'id=?',[$ex['id']]);
        else     DB::insert('canva_tokens',$data);
        header('Location: /?oauth_success=canva&name='.urlencode($name)); exit;
    } catch (Exception $e) { header('Location: /?oauth_error='.urlencode($e->getMessage())); exit; }
});

$router->get('/canva/designs', function() {
    $user = Auth::require();
    $row  = DB::one('SELECT * FROM canva_tokens WHERE user_id=?', [$user['id']]);
    if (!$row) Response::json(['error'=>'Canva not connected'],404);
    $token = Crypto::dec($row['access_token']);
    $designs = CanvaOAuth::listDesigns($token, 30);
    Response::ok(['designs'=>$designs,'profile'=>$row['profile_name']]);
});

$router->post('/canva/import', function() {
    $user = Auth::require();
    $b    = body();
    $row  = DB::one('SELECT * FROM canva_tokens WHERE user_id=?', [$user['id']]);
    if (!$row) throw new RuntimeException('Canva not connected');
    $token    = Crypto::dec($row['access_token']);
    $imageUrl = $b['image_url'] ?? '';
    if (!$imageUrl) throw new ValidationException('image_url required');
    // Download from Canva and save to media
    $data = @file_get_contents($imageUrl, false, stream_context_create(['http'=>['header'=>"Authorization: Bearer {$token}"]]));
    if (!$data) {
        // If direct URL, try without auth
        $data = @file_get_contents($imageUrl);
    }
    if (!$data) throw new RuntimeException('Could not fetch image from Canva');
    $filename = 'canva_'.time().'.png';
    $dir = STORAGE_PATH . '/media/';
    @mkdir($dir, 0775, true);
    file_put_contents($dir . $filename, $data);
    $url  = rtrim(getenv('FP_APP_URL'),'/') . '/storage/media/' . $filename;
    $mid  = DB::insert('media',['site_id'=>null,'uploader_id'=>$user['id'],'filename'=>$filename,'path'=>$dir.$filename,'url'=>$url,'mime_type'=>'image/png','size'=>strlen($data),'alt_text'=>'From Canva']);
    Response::ok(['url'=>$url,'media_id'=>$mid]);
});

$router->get('/canva/status', function() {
    $user = Auth::require();
    $row  = DB::one('SELECT profile_name, expires_at FROM canva_tokens WHERE user_id=?', [$user['id']]);
    Response::ok(['connected'=>!!$row,'name'=>$row['profile_name']??null]);
});


// ── EMAIL SUBSCRIBERS ─────────────────────────────────────────────────────────
$router->get('/email/subscribers', function() {
    Auth::require();
    $siteId = param('site_id'); $status = param('status','subscribed'); $q = param('q');
    $where = ["status=?"];$params=[$status];
    if ($siteId){$where[]='(site_id=? OR site_id IS NULL)';$params[]=(int)$siteId;}
    if ($q){$where[]='(email LIKE ? OR name LIKE ?)';$like='%'.$q.'%';$params=[...$params,$like,$like];}
    $w=implode(' AND ',$where);
    $total=DB::count("SELECT COUNT(*) FROM email_subscribers WHERE $w",$params);
    $page=max(1,(int)param('page',1));$pp=50;$off=($page-1)*$pp;
    $params[]=$pp;$params[]=$off;
    $items=DB::all("SELECT * FROM email_subscribers WHERE $w ORDER BY subscribed_at DESC LIMIT ? OFFSET ?",$params);
    Response::paginate($items,$total,$page,$pp);
});

$router->post('/email/subscribers', function() {
    Auth::require();
    $b=body();required($b,['email']);
    $id=DB::insert('email_subscribers',['site_id'=>isset($b['site_id'])?(int)$b['site_id']:null,'email'=>strtolower(trim($b['email'])),'name'=>$b['name']??null,'tags'=>$b['tags']??null,'source'=>'manual']);
    Response::ok(['id'=>$id],'Subscriber added');
});

$router->post('/email/subscribers/import', function() {
    Auth::require();
    $b=body();required($b,['subscribers']);
    $siteId=isset($b['site_id'])?(int)$b['site_id']:null;
    $added=0;
    foreach ((array)$b['subscribers'] as $s) {
        $email=strtolower(trim(is_array($s)?($s['email']??''):$s));
        if (!filter_var($email,FILTER_VALIDATE_EMAIL)) continue;
        try{DB::insert('email_subscribers',['site_id'=>$siteId,'email'=>$email,'name'=>is_array($s)?($s['name']??null):null,'source'=>'import']);$added++;}catch(\Throwable $e){}
    }
    Response::ok(['added'=>$added],"$added subscribers imported");
});

$router->delete('/email/subscribers/{id}', function(array $p) {
    Auth::require();
    DB::update('email_subscribers',['status'=>'unsubscribed','unsubscribed_at'=>date('Y-m-d H:i:s')],'id=?',[(int)$p['id']]);
    Response::ok(null,'Unsubscribed');
});

$router->get('/email/subscribers/count', function() {
    Auth::require();
    $subscribed=DB::count("SELECT COUNT(*) FROM email_subscribers WHERE status='subscribed'");
    $total=DB::count("SELECT COUNT(*) FROM email_subscribers");
    Response::ok(['subscribed'=>$subscribed,'total'=>$total]);
});

// ── EMAIL CAMPAIGNS ───────────────────────────────────────────────────────────
$router->get('/email/campaigns', function() {
    Auth::require();
    Response::ok(DB::all('SELECT * FROM email_campaigns ORDER BY created_at DESC LIMIT 50'));
});

$router->post('/email/campaigns', function() {
    Auth::requireRole('admin','editor');
    $b=body();required($b,['name','subject','html_body']);
    $u=Auth::require();
    $id=DB::insert('email_campaigns',['site_id'=>isset($b['site_id'])?(int)$b['site_id']:null,'name'=>$b['name'],'subject'=>$b['subject'],'from_name'=>$b['from_name']??'FlowPost','from_email'=>$b['from_email']??getenv('SMTP_USER'),'reply_to'=>$b['reply_to']??null,'html_body'=>$b['html_body'],'plain_body'=>$b['plain_body']??null,'status'=>'draft','created_by'=>$u['id']]);
    Response::ok(['id'=>$id],'Campaign created');
});

$router->put('/email/campaigns/{id}', function(array $p) {
    Auth::requireRole('admin','editor');
    $b=body();
    $allowed=['name','subject','from_name','from_email','reply_to','html_body','plain_body','status','scheduled_at'];
    $upd=array_intersect_key($b,array_flip($allowed));
    if($upd) DB::update('email_campaigns',$upd,'id=?',[(int)$p['id']]);
    Response::ok(null,'Updated');
});

$router->delete('/email/campaigns/{id}', function(array $p) {
    Auth::requireRole('admin');
    DB::run('DELETE FROM email_campaigns WHERE id=?',[(int)$p['id']]);
    Response::ok(null,'Deleted');
});

$router->post('/email/campaigns/{id}/send', function(array $p) {
    Auth::requireRole('admin','editor');
    DB::update('email_campaigns',['status'=>'sending'],'id=?',[(int)$p['id']]);
    $result=EmailService::sendCampaign((int)$p['id']);
    Response::ok($result,'Campaign sent');
});

$router->post('/email/campaigns/{id}/test', function(array $p) {
    Auth::requireRole('admin','editor');
    $b=body();required($b,['to']);
    $c=DB::one('SELECT * FROM email_campaigns WHERE id=?',[(int)$p['id']]);
    if(!$c) throw new NotFoundException('Campaign not found');
    $ok=EmailService::send($b['to'],'Test',$c['subject'],'[TEST] '.$c['html_body'],'',['from_email'=>$c['from_email'],'from_name'=>$c['from_name']]);
    Response::ok(['sent'=>$ok],$ok?'Test sent!':'Send failed');
});

// ── EMAIL TRACKING ────────────────────────────────────────────────────────────
$router->get('/email/track/open/{tid}', function(array $p) {
    $row=DB::one('SELECT * FROM email_sends WHERE tracking_id=?',[$p['tid']]);
    if($row){DB::update('email_sends',['status'=>'opened','open_count'=>(int)$row['open_count']+1,'opened_at'=>$row['opened_at']??date('Y-m-d H:i:s')],'id=?',[$row['id']]);DB::update('email_campaigns',['total_opens'=>DB::count("SELECT COUNT(*) FROM email_sends WHERE campaign_id=? AND open_count>0",[$row['campaign_id']])],'id=?',[$row['campaign_id']]);}
    header('Content-Type: image/gif');
    echo base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
    exit;
});

$router->get('/email/unsubscribe', function() {
    $email=urldecode($_GET['email']??'');
    if($email){DB::update('email_subscribers',['status'=>'unsubscribed','unsubscribed_at'=>date('Y-m-d H:i:s')],'email=?',[$email]);}
    header('Content-Type: text/html');
    echo '<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>You have been unsubscribed</h2><p>You will no longer receive emails from us.</p></body></html>';
    exit;
});

// ── EMAIL SETTINGS ────────────────────────────────────────────────────────────
$router->get('/email/settings', function() {
    Auth::requireRole('admin');
    $keys=['email_from','email_from_name','smtp_host','smtp_port','smtp_user'];
    $rows=DB::all("SELECT key_name,value FROM settings WHERE key_name IN ('".implode("','",$keys)."')");
    Response::ok(array_column($rows,'value','key_name'));
});

$router->post('/email/settings', function() {
    Auth::requireRole('admin');
    $b=body();
    $allowed=['email_from','email_from_name','smtp_host','smtp_port','smtp_user','smtp_pass'];
    foreach($allowed as $k){
        if(isset($b[$k])){
            $ex=DB::one('SELECT id FROM settings WHERE key_name=?',[$k]);
            if($ex) DB::update('settings',['value'=>$b[$k]],'key_name=?',[$k]);
            else    DB::insert('settings',['key_name'=>$k,'value'=>$b[$k]]);
        }
    }
    Response::ok(null,'Email settings saved');
});

$router->post('/email/test-connection', function() {
    Auth::requireRole('admin');
    $b=body();
    $ok=EmailService::send($b['to']??Auth::require()['email'],'Test','FlowPost Email Test','<p>Your FlowPost email is configured correctly!</p>');
    Response::ok(['sent'=>$ok],$ok?'Test email sent!':'Failed — check SMTP settings');
});

require_once __DIR__."/core/ApiAuth.php";

// NOTIFICATIONS
$router->get("/notifications",function(){
    $u=Auth::require();
    $rows=DB::all("SELECT * FROM notifications WHERE (user_id=? OR user_id IS NULL) ORDER BY created_at DESC LIMIT 30",[$u["id"]]);
    Response::ok($rows);
});
$router->post("/notifications/{id}/read",function(array $p){
    $u=Auth::require();
    DB::update("notifications",["is_read"=>1],"id=?",[(int)$p["id"]]);
    Response::ok(null,"Marked read");
});
$router->post("/notifications/read-all",function(){
    $u=Auth::require();
    DB::run("UPDATE notifications SET is_read=1 WHERE user_id=? OR user_id IS NULL",[$u["id"]]);
    Response::ok(null,"All read");
});
require_once __DIR__."/core/ExternalRoutes.php";

// ── Image Edit Routes ──────────────────────────────────────────
$router->post('/ai/remove-background', function() {
    Auth::require();
    $b = body();
    $mediaId = (int)($b['media_id'] ?? 0);
    if (!$mediaId) Response::json(['error'=>'media_id required'], 400);
    $media = DB::one('SELECT * FROM media WHERE id=?', [$mediaId]);
    if (!$media) Response::json(['error'=>'Media not found'], 404);

    // Use remove.bg API if key exists, else return error
    $apiKey = DB::one("SELECT value FROM settings WHERE key_name='removebg_api_key'")['value'] ?? getenv('REMOVEBG_API_KEY');
    if (!$apiKey) {
        // Fallback: return original with note
        Response::ok(['url'=>$media['url'], 'media_id'=>$mediaId, 'note'=>'Add remove.bg API key in Settings to enable background removal']);
        return;
    }
    $ch = curl_init('https://api.remove.bg/v1.0/removebg');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER=>true, CURLOPT_POST=>true,
        CURLOPT_POSTFIELDS=>['image_url'=>$media['url'],'size'=>'auto'],
        CURLOPT_HTTPHEADER=>["X-Api-Key: $apiKey"],
    ]);
    $result = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    if ($code !== 200) Response::json(['error'=>'Remove.bg failed: '.$code], 500);
    $fname = 'nobg_'.time().'.png';
    $dir = '/var/www/flowpost/backend/storage/media/';
    file_put_contents($dir.$fname, $result);
    $url = (getenv('FP_APP_URL')?:'').'/storage/media/'.$fname;
    $newId = DB::insert('media',['uploader_id'=>Auth::user()['id'],'filename'=>$fname,'path'=>'media/'.$fname,'url'=>$url,'mime_type'=>'image/png','alt_text'=>'BG Removed']);
    Response::ok(['url'=>$url, 'media_id'=>$newId]);
});

$router->post('/ai/resize-image', function() {
    Auth::require();
    $b = body(); $mediaId=(int)($b['media_id']??0); $w=(int)($b['width']??1080); $h=(int)($b['height']??1080);
    $media = DB::one('SELECT * FROM media WHERE id=?', [$mediaId]);
    if (!$media) Response::json(['error'=>'Media not found'], 404);
    if (!extension_loaded('gd')) Response::json(['error'=>'GD not available'], 500);
    $imgData = @file_get_contents($media['url']);
    if (!$imgData) Response::json(['error'=>'Cannot fetch image'], 500);
    $src = @imagecreatefromstring($imgData);
    if (!$src) Response::json(['error'=>'Invalid image'], 500);
    $dst = imagecreatetruecolor($w, $h);
    imagefill($dst, 0, 0, imagecolorallocate($dst, 255,255,255));
    $sw = imagesx($src); $sh = imagesy($src);
    $ratio = min($w/$sw, $h/$sh);
    $nw = (int)($sw*$ratio); $nh = (int)($sh*$ratio);
    $ox = (int)(($w-$nw)/2); $oy = (int)(($h-$nh)/2);
    imagecopyresampled($dst,$src,$ox,$oy,0,0,$nw,$nh,$sw,$sh);
    imagedestroy($src);
    $fname = 'resize_'.$w.'x'.$h.'_'.time().'.jpg';
    $dir = '/var/www/flowpost/backend/storage/media/';
    imagejpeg($dst, $dir.$fname, 90); imagedestroy($dst);
    $url = (getenv('FP_APP_URL')?:'').'/storage/media/'.$fname;
    $newId = DB::insert('media',['uploader_id'=>Auth::user()['id'],'filename'=>$fname,'path'=>'media/'.$fname,'url'=>$url,'mime_type'=>'image/jpeg','alt_text'=>"Resized {$w}x{$h}"]);
    Response::ok(['url'=>$url, 'media_id'=>$newId]);
});

$router->post('/ai/enhance-image', function() {
    Auth::require();
    $b = body(); $mediaId=(int)($b['media_id']??0);
    $media = DB::one('SELECT * FROM media WHERE id=?', [$mediaId]);
    if (!$media) Response::json(['error'=>'Media not found'], 404);
    // For now return original with sharpening via GD
    if (!extension_loaded('gd')) Response::json(['error'=>'GD not available'], 500);
    $imgData = @file_get_contents($media['url']);
    $src = @imagecreatefromstring($imgData);
    if (!$src) Response::json(['error'=>'Invalid image'], 500);
    // Apply sharpen matrix
    $sharpen = [[-1,-1,-1],[-1,16,-1],[-1,-1,-1]];
    $divisor = 8; $offset = 0;
    imageconvolution($src, $sharpen, $divisor, $offset);
    $fname = 'enhanced_'.time().'.jpg';
    $dir = '/var/www/flowpost/backend/storage/media/';
    imagejpeg($src, $dir.$fname, 95); imagedestroy($src);
    $url = (getenv('FP_APP_URL')?:'').'/storage/media/'.$fname;
    $newId = DB::insert('media',['uploader_id'=>Auth::user()['id'],'filename'=>$fname,'path'=>'media/'.$fname,'url'=>$url,'mime_type'=>'image/jpeg','alt_text'=>'Enhanced']);
    Response::ok(['url'=>$url, 'media_id'=>$newId]);
});








// ═══════════════════════════════════════════════════════════════
// WEBHOOKS
// ═══════════════════════════════════════════════════════════════
$router->get('/webhooks', function() {
    Auth::require(); $u=Auth::user();
    $siteId=(int)($_GET['site_id']??0);
    $rows=DB::all('SELECT * FROM webhooks WHERE site_id=? AND user_id=? ORDER BY id DESC',[$siteId,$u['id']]);
    Response::ok($rows);
});
$router->post('/webhooks', function() {
    Auth::require(); $u=Auth::user(); $b=body();
    $id=DB::insert('webhooks',['site_id'=>(int)($b['site_id']??0),'user_id'=>$u['id'],'name'=>$b['name']??'Webhook','url'=>$b['url']??'','secret'=>$b['secret']??null,'events'=>$b['events']??'post.published,post.failed','active'=>1]);
    Response::ok(DB::one('SELECT * FROM webhooks WHERE id=?',[$id]));
});
$router->put('/webhooks/{id}', function($id) {
    Auth::require(); $b=body();
    DB::update('webhooks',['name'=>$b['name']??'Webhook','url'=>$b['url']??'','events'=>$b['events']??'post.published,post.failed','active'=>(int)($b['active']??1)],'id=?',[(int)$id]);
    Response::ok(['ok'=>true]);
});
$router->delete('/webhooks/{id}', function($id) {
    Auth::require();
    DB::raw('DELETE FROM webhooks WHERE id=?',[(int)$id]);
    Response::ok(['ok'=>true]);
});

// ═══════════════════════════════════════════════════════════════
// SIGNATURES
// ═══════════════════════════════════════════════════════════════
$router->get('/signatures', function() {
    Auth::require(); $u=Auth::user();
    Response::ok(DB::all('SELECT * FROM signatures WHERE user_id=? ORDER BY id DESC',[$u['id']]));
});
$router->post('/signatures', function() {
    Auth::require(); $u=Auth::user(); $b=body();
    $id=DB::insert('signatures',['user_id'=>$u['id'],'name'=>$b['name']??'My Signature','content'=>$b['content']??'']);
    Response::ok(DB::one('SELECT * FROM signatures WHERE id=?',[$id]));
});
$router->put('/signatures/{id}', function($id) {
    Auth::require(); $b=body();
    DB::update('signatures',['name'=>$b['name']??'','content'=>$b['content']??''],'id=?',[(int)$id]);
    Response::ok(['ok'=>true]);
});
$router->delete('/signatures/{id}', function($id) {
    Auth::require();
    DB::raw('DELETE FROM signatures WHERE id=?',[(int)$id]);
    Response::ok(['ok'=>true]);
});

// ═══════════════════════════════════════════════════════════════
// SETS (Platform Groups)
// ═══════════════════════════════════════════════════════════════
$router->get('/sets', function() {
    Auth::require(); $u=Auth::user();
    $siteId=(int)($_GET['site_id']??0);
    Response::ok(DB::all('SELECT * FROM platform_sets WHERE site_id=? AND user_id=? ORDER BY id DESC',[$siteId,$u['id']]));
});
$router->post('/sets', function() {
    Auth::require(); $u=Auth::user(); $b=body();
    $id=DB::insert('platform_sets',['site_id'=>(int)($b['site_id']??0),'user_id'=>$u['id'],'name'=>$b['name']??'My Set','connection_ids'=>json_encode($b['connection_ids']??[])]);
    Response::ok(DB::one('SELECT * FROM platform_sets WHERE id=?',[$id]));
});
$router->put('/sets/{id}', function($id) {
    Auth::require(); $b=body();
    DB::update('platform_sets',['name'=>$b['name']??'','connection_ids'=>json_encode($b['connection_ids']??[])],'id=?',[(int)$id]);
    Response::ok(['ok'=>true]);
});
$router->delete('/sets/{id}', function($id) {
    Auth::require();
    DB::raw('DELETE FROM platform_sets WHERE id=?',[(int)$id]);
    Response::ok(['ok'=>true]);
});

// ═══════════════════════════════════════════════════════════════
// AUTO POST (RSS)
// ═══════════════════════════════════════════════════════════════
$router->get('/auto-posts', function() {
    Auth::require(); $u=Auth::user();
    $siteId=(int)($_GET['site_id']??0);
    Response::ok(DB::all('SELECT * FROM auto_posts WHERE site_id=? AND user_id=? ORDER BY id DESC',[$siteId,$u['id']]));
});
$router->post('/auto-posts', function() {
    Auth::require(); $u=Auth::user(); $b=body();
    $id=DB::insert('auto_posts',['site_id'=>(int)($b['site_id']??0),'user_id'=>$u['id'],'name'=>$b['name']??'RSS Feed','type'=>$b['type']??'rss','source_url'=>$b['source_url']??null,'connection_ids'=>json_encode($b['connection_ids']??[]),'template'=>$b['template']??null,'frequency'=>$b['frequency']??'hourly','active'=>1]);
    Response::ok(DB::one('SELECT * FROM auto_posts WHERE id=?',[$id]));
});
$router->put('/auto-posts/{id}', function($id) {
    Auth::require(); $b=body();
    DB::update('auto_posts',['name'=>$b['name']??'','source_url'=>$b['source_url']??null,'connection_ids'=>json_encode($b['connection_ids']??[]),'template'=>$b['template']??null,'frequency'=>$b['frequency']??'hourly','active'=>(int)($b['active']??1)],'id=?',[(int)$id]);
    Response::ok(['ok'=>true]);
});
$router->delete('/auto-posts/{id}', function($id) {
    Auth::require();
    DB::raw('DELETE FROM auto_posts WHERE id=?',[(int)$id]);
    Response::ok(['ok'=>true]);
});
$router->post('/auto-posts/{id}/run', function($id) {
    Auth::require();
    $ap = DB::one('SELECT * FROM auto_posts WHERE id=?',[(int)$id]);
    if (!$ap) Response::json(['error'=>'Not found'],404);
    if ($ap['type']==='rss' && $ap['source_url']) {
        $xml = @simplexml_load_file($ap['source_url']);
        if (!$xml) Response::json(['error'=>'Cannot fetch RSS feed'],400);
        $items = [];
        foreach($xml->channel->item as $item) {
            $items[] = ['title'=>(string)$item->title,'link'=>(string)$item->link,'desc'=>(string)$item->description];
            if(count($items)>=5) break;
        }
        DB::update('auto_posts',['last_run'=>date('Y-m-d H:i:s')],'id=?',[(int)$id]);
        Response::ok(['items'=>$items]);
    }
    Response::ok(['ok'=>true]);
});

// ═══════════════════════════════════════════════════════════════
// TEAMS
// ═══════════════════════════════════════════════════════════════
$router->get('/team', function() {
    Auth::require(); $u=Auth::user();
    Response::ok(DB::all('SELECT tm.*, u.email as member_email, u.name as member_name FROM team_members tm LEFT JOIN users u ON u.id=tm.member_user_id WHERE tm.org_user_id=? ORDER BY tm.id',[$u['id']]));
});
$router->post('/team/invite', function() {
    Auth::require(); $u=Auth::user(); $b=body();
    $email=$b['email']??''; $role=$b['role']??'editor';
    if(!$email) Response::json(['error'=>'Email required'],400);
    $token=bin2hex(random_bytes(16));
    $ex=DB::one('SELECT id FROM team_members WHERE org_user_id=? AND email=?',[$u['id'],$email]);
    if($ex) Response::json(['error'=>'Already invited'],400);
    DB::insert('team_members',['org_user_id'=>$u['id'],'email'=>$email,'role'=>$role,'invite_token'=>$token,'accepted'=>0]);
    $inviteUrl = rtrim(APP_URL, '/') . '/api/team/accept/' . $token;
    $orgName = $u['name'] ?? 'A FlowPost admin';
    $html = '<p>You have been invited by '.htmlspecialchars($orgName, ENT_QUOTES, 'UTF-8').' to join FlowPost.</p>'
          . '<p><a href="'.htmlspecialchars($inviteUrl, ENT_QUOTES, 'UTF-8').'">Accept your invitation</a></p>';
    $sent = EmailService::send($email, '', 'You have been invited to FlowPost', $html, strip_tags($html));
    Response::ok(['token'=>$token,'invite_url'=>$inviteUrl,'email_sent'=>$sent], $sent ? 'Invitation sent' : 'Invitation created; email could not be sent');
});
$router->delete('/team/{id}', function($id) {
    Auth::require(); $u=Auth::user();
    DB::raw('DELETE FROM team_members WHERE id=? AND org_user_id=?',[(int)$id,$u['id']]);
    Response::ok(['ok'=>true]);
});
$router->get('/team/accept/{token}', function($token) {
    $row=DB::one('SELECT * FROM team_members WHERE invite_token=?',[$token]);
    if(!$row) Response::json(['error'=>'Invalid token'],404);
    DB::update('team_members',['accepted'=>1,'invite_token'=>null],'id=?',[$row['id']]);
    header('Location: /?team_accepted=1'); exit;
});

// ═══════════════════════════════════════════════════════════════
// ANNOUNCEMENTS
// ═══════════════════════════════════════════════════════════════
$router->get('/announcements', function() {
    Response::ok(DB::all('SELECT * FROM announcements WHERE active=1 ORDER BY id DESC LIMIT 5'));
});
$router->post('/announcements', function() {
    Auth::require();
    $b=body();
    $id=DB::insert('announcements',['title'=>$b['title']??'','content'=>$b['content']??'','type'=>$b['type']??'info','active'=>1]);
    Response::ok(DB::one('SELECT * FROM announcements WHERE id=?',[$id]));
});
$router->delete('/announcements/{id}', function($id) {
    Auth::require();
    DB::raw('DELETE FROM announcements WHERE id=?',[(int)$id]);
    Response::ok(['ok'=>true]);
});

// ═══════════════════════════════════════════════════════════════
// PUBLIC API v1
// ═══════════════════════════════════════════════════════════════
$router->get('/v1/posts', function() {
    $token = str_replace('Bearer ','', $_SERVER['HTTP_AUTHORIZATION']??'');
    $tk = DB::one('SELECT * FROM api_tokens WHERE token_hash=?',[$token]);
    if(!$tk) Response::json(['error'=>'Unauthorized'],401);
    $siteId = (int)($_GET['site_id']??0);
    $limit  = min((int)($_GET['limit']??50), 100);
    $status = $_GET['status']??'';
    $where  = []; $params = [];
    if($siteId){ $where[]='p.site_id=?'; $params[]=$siteId; }
    if($status){ $where[]='p.status=?'; $params[]=$status; }
    $sql = 'SELECT p.id,p.caption,p.status,p.scheduled_at,p.created_at,s.name as site_name FROM posts p LEFT JOIN sites s ON s.id=p.site_id'.($where?' WHERE '.implode(' AND ',$where):'').' ORDER BY p.id DESC LIMIT '.$limit;
    $posts = DB::all($sql,$params);
    Response::ok(['data'=>['data'=>$posts],'total'=>count($posts)]);
});
$router->post('/v1/posts', function() {
    $token = str_replace('Bearer ','', $_SERVER['HTTP_AUTHORIZATION']??'');
    $tk = DB::one('SELECT * FROM api_tokens WHERE token_hash=?',[$token]);
    if(!$tk) Response::json(['error'=>'Unauthorized'],401);
    $b=body();
    require_once __DIR__.'/models/PostModel.php';
    $id = PostModel::create(['user_id'=>$tk['user_id'],'site_id'=>(int)($b['site_id']??1),'caption'=>$b['caption']??'','status'=>'draft','connection_ids'=>json_encode($b['connection_ids']??[]),'scheduled_at'=>$b['scheduled_at']??null]);
    Response::ok(['id'=>$id,'status'=>'created']);
});
$router->get('/v1/connections', function() {
    $token = str_replace('Bearer ','', $_SERVER['HTTP_AUTHORIZATION']??'');
    $tk = DB::one('SELECT * FROM api_tokens WHERE token_hash=?',[$token]);
    if(!$tk) Response::json(['error'=>'Unauthorized'],401);
    $conns = DB::all('SELECT pc.id,pc.account_name,pc.account_id,pc.site_id,p.key_name,p.name as platform_name FROM platform_connections pc JOIN platforms p ON p.id=pc.platform_id WHERE pc.connected=1');
    Response::ok(['data'=>$conns]);
});
$router->get('/v1/sites', function() {
    $token = str_replace('Bearer ','', $_SERVER['HTTP_AUTHORIZATION']??'');
    $tk = DB::one('SELECT * FROM api_tokens WHERE token_hash=?',[$token]);
    if(!$tk) Response::json(['error'=>'Unauthorized'],401);
    Response::ok(['data'=>DB::all('SELECT id,name FROM sites ORDER BY id')]);
});


// Developer API Key Routes
$router->get('/developer/api-key', function() {
    Auth::require(); $u = Auth::user();
    // Read+Write key
    $rw = DB::one('SELECT token_hash FROM api_tokens WHERE user_id=? AND label=?', [$u['id'], 'developer_key']);
    if (!$rw) {
        $token = 'fp_rw_' . bin2hex(random_bytes(20));
        DB::insert('api_tokens', ['user_id'=>$u['id'], 'label'=>'developer_key', 'token_hash'=>$token, 'scopes'=>'*']);
        $rw = ['token_hash'=>$token];
    }
    // Read-only key
    $ro = DB::one('SELECT token_hash FROM api_tokens WHERE user_id=? AND label=?', [$u['id'], 'developer_key_ro']);
    if (!$ro) {
        $token = 'fp_ro_' . bin2hex(random_bytes(20));
        DB::insert('api_tokens', ['user_id'=>$u['id'], 'label'=>'developer_key_ro', 'token_hash'=>$token, 'scopes'=>'read']);
        $ro = ['token_hash'=>$token];
    }
    Response::ok(['key'=>$rw['token_hash'], 'readonly_key'=>$ro['token_hash']]);
});
$router->post('/developer/rotate-key', function() {
    Auth::require(); $u = Auth::user();
    $scope = $_POST['scope'] ?? (json_decode(file_get_contents('php://input'),true)['scope'] ?? 'write');
    $label = $scope === 'read' ? 'developer_key_ro' : 'developer_key';
    $prefix = $scope === 'read' ? 'fp_ro_' : 'fp_rw_';
    $token = $prefix . bin2hex(random_bytes(20));
    $ex = DB::one('SELECT id FROM api_tokens WHERE user_id=? AND label=?', [$u['id'], $label]);
    if ($ex) DB::update('api_tokens', ['token_hash'=>$token], 'id=?', [$ex['id']]);
    else DB::insert('api_tokens', ['user_id'=>$u['id'], 'label'=>$label, 'token_hash'=>$token, 'scopes'=>$scope==='read'?'read':'*']);
    Response::ok(['key'=>$token, 'scope'=>$scope]);
});



// ═══════════════════════════════════════════════════════════════
// INTEGRATIONS
// ═══════════════════════════════════════════════════════════════

// List inbound webhooks
$router->get('/integrations/inbound', function() {
    Auth::require(); $u = Auth::user();
    $rows = DB::all('SELECT * FROM inbound_webhooks WHERE user_id=? ORDER BY id DESC', [$u['id']]);
    Response::ok($rows);
});

// Create inbound webhook
$router->post('/integrations/inbound', function() {
    Auth::require(); $u = Auth::user();
    $b = json_decode(file_get_contents('php://input'), true) ?? [];
    if (empty($b['name']) || empty($b['site_id'])) Response::json(['error'=>'Name and site required'], 400);
    $token = bin2hex(random_bytes(24));
    $id = DB::insert('inbound_webhooks', [
        'user_id'       => $u['id'],
        'site_id'       => (int)$b['site_id'],
        'name'          => substr($b['name'], 0, 128),
        'token'         => $token,
        'source'        => $b['source'] ?? 'generic',
        'template'      => $b['template'] ?? null,
        'platforms'     => $b['platforms'] ?? null,
        'auto_schedule' => isset($b['auto_schedule']) ? (int)$b['auto_schedule'] : 1,
        'schedule_time' => $b['schedule_time'] ?? '09:00',
        'active'        => 1,
    ]);
    Response::ok(DB::one('SELECT * FROM inbound_webhooks WHERE id=?', [$id]), 'Inbound webhook created!');
});

// Delete inbound webhook
$router->delete('/integrations/inbound/{id}', function(array $p) {
    Auth::require(); $u = Auth::user();
    DB::run('DELETE FROM inbound_webhooks WHERE id=? AND user_id=?', [(int)$p['id'], $u['id']]);
    Response::ok(['ok'=>true]);
});

// ── Inbound Webhook Receiver (no auth — token-based) ──────────
$router->post('/inbound/{token}', function(array $p) {
    $hook = DB::one('SELECT * FROM inbound_webhooks WHERE token=? AND active=1', [$p['token']]);
    if (!$hook) Response::json(['error'=>'Invalid webhook token'], 404);

    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    // Build caption from template or body
    $caption = '';
    if ($hook['template']) {
        $caption = $hook['template'];
        foreach ($body as $k => $v) {
            if (is_scalar($v)) $caption = str_replace('{{'.$k.'}}', $v, $caption);
        }
    } else {
        // Auto-extract meaningful text from payload
        $caption = $body['caption'] ?? $body['message'] ?? $body['text'] ?? $body['content'] ??
                   $body['title'] ?? $body['name'] ?? $body['subject'] ?? json_encode($body);
        $caption = substr((string)$caption, 0, 2000);
    }

    // Determine platforms
    $platformsJson = $hook['platforms'] ?? null;
    $platformIds = $platformsJson ? json_decode($platformsJson, true) : [];

    // Create post
    $scheduleTime = $hook['schedule_time'] ?? '09:00';
    $fireAt = date('Y-m-d') . ' ' . $scheduleTime . ':00';
    if (strtotime($fireAt) <= time()) $fireAt = date('Y-m-d H:i:s', time() + 300);

    $postId = DB::insert('posts', [
        'user_id'      => $hook['user_id'],
        'site_id'      => $hook['site_id'],
        'caption'      => $caption,
        'status'       => 'scheduled',
        'scheduled_at' => $fireAt,
        'created_at'   => date('Y-m-d H:i:s'),
    ]);

    // Add targets if platform IDs provided
    if ($platformIds) {
        $conns = DB::all('SELECT id, platform_id FROM platform_connections WHERE site_id=? AND connected=1', [$hook['site_id']]);
        foreach ($conns as $c) {
            if (in_array($c['platform_id'], $platformIds)) {
                DB::insert('post_targets', [
                    'post_id'       => $postId,
                    'platform_id'   => $c['platform_id'],
                    'connection_id' => $c['id'],
                    'status'        => 'pending',
                ]);
            }
        }
    }

    // Add to publish queue
    DB::insert('publish_queue', ['post_id'=>$postId, 'priority'=>5, 'fire_at'=>$fireAt]);

    // Update stats
    DB::run('UPDATE inbound_webhooks SET trigger_count=trigger_count+1, last_triggered=NOW() WHERE id=?', [$hook['id']]);

    Response::ok(['post_id'=>$postId, 'scheduled_at'=>$fireAt, 'caption_preview'=>substr($caption,0,100)]);
});

// ── Zapier polling endpoint (last 10 published posts) ─────────
$router->get('/integrations/zapier/posts', function() {
    $token = str_replace('Bearer ', '', $_SERVER['HTTP_AUTHORIZATION'] ?? '');
    $tk = $token ? DB::one('SELECT * FROM api_tokens WHERE token_hash=?', [$token]) : null;
    if (!$tk) Response::json(['error'=>'Unauthorized'], 401);
    $posts = DB::all("SELECT p.id, p.caption, p.status, p.published_at, p.scheduled_at, s.name as site
                      FROM posts p LEFT JOIN sites s ON s.id=p.site_id
                      WHERE p.user_id=? AND p.status='published'
                      ORDER BY p.published_at DESC LIMIT 10", [$tk['user_id']]);
    Response::ok($posts);
});

// ── Integration status (which are configured) ─────────────────
$router->get('/integrations/status', function() {
    Auth::require(); $u = Auth::user();
    $settings = DB::one('SELECT * FROM settings WHERE user_id=?', [$u['id']]) ?? [];
    $inbound  = DB::all('SELECT COUNT(*) as c FROM inbound_webhooks WHERE user_id=? AND active=1', [$u['id']])[0] ?? ['c'=>0];
    $outbound = DB::all('SELECT COUNT(*) as c FROM webhooks WHERE user_id=? AND active=1', [$u['id']])[0] ?? ['c'=>0];
    Response::ok([
        'zapier'    => ['connected'=>false, 'docs_url'=>(getenv('FP_APP_URL')?:'').'/api/integrations/zapier/posts'],
        'make'      => ['connected'=>false],
        'n8n'       => ['connected'=>false],
        'shopify'   => ['connected'=>!empty($settings['shopify_webhook_secret'])],
        'woocommerce'=> ['connected'=>false],
        'hubspot'   => ['connected'=>false],
        'inbound_count'  => (int)$inbound['c'],
        'outbound_count' => (int)$outbound['c'],
    ]);
});


// ═══════════════════════════════════════════════════════════════
// LEAD OUTREACH (LinkedIn Sales Navigator)
// ═══════════════════════════════════════════════════════════════

$router->get('/lead-outreach', function() {
    Auth::require(); $u = Auth::user();
    $siteId = (int)($_GET['site_id'] ?? 0);
    $status = $_GET['status'] ?? '';
    $sql = 'SELECT * FROM lead_outreach WHERE user_id=?';
    $params = [$u['id']];
    if ($siteId) { $sql .= ' AND site_id=?'; $params[] = $siteId; }
    if ($status) { $sql .= ' AND status=?'; $params[] = $status; }
    $sql .= ' ORDER BY id DESC LIMIT 200';
    Response::ok(DB::all($sql, $params));
});

$router->post('/lead-outreach/import', function() {
    Auth::require(); $u = Auth::user();
    $b = json_decode(file_get_contents('php://input'), true) ?? [];
    $leads = $b['leads'] ?? [];
    $siteId = (int)($b['site_id'] ?? 1);
    if (!$leads) Response::json(['error'=>'No leads provided'], 400);
    $imported = 0;
    foreach ($leads as $lead) {
        DB::insert('lead_outreach', [
            'user_id'     => $u['id'],
            'site_id'     => $siteId,
            'first_name'  => substr($lead['first_name'] ?? '', 0, 100),
            'last_name'   => substr($lead['last_name'] ?? '', 0, 100),
            'company'     => substr($lead['company'] ?? '', 0, 200),
            'title'       => substr($lead['title'] ?? '', 0, 200),
            'linkedin_url'=> substr($lead['linkedin_url'] ?? $lead['url'] ?? '', 0, 512),
            'email'       => substr($lead['email'] ?? '', 0, 200),
            'industry'    => substr($lead['industry'] ?? '', 0, 200),
            'location'    => substr($lead['location'] ?? '', 0, 200),
            'notes'       => $lead['notes'] ?? null,
            'status'      => 'new',
        ]);
        $imported++;
    }
    Response::ok(['imported'=>$imported], "$imported leads imported!");
});

$router->post('/lead-outreach/generate', function() {
    Auth::require(); $u = Auth::user();
    $b = json_decode(file_get_contents('php://input'), true) ?? [];
    $leadId = (int)($b['lead_id'] ?? 0);
    $type   = $b['type'] ?? 'linkedin_post'; // linkedin_post, connection_request, follow_up
    $tone   = $b['tone'] ?? 'professional';
    $product = $b['product'] ?? '';

    $lead = DB::one('SELECT * FROM lead_outreach WHERE id=? AND user_id=?', [$leadId, $u['id']]);
    if (!$lead) Response::json(['error'=>'Lead not found'], 404);

    $name    = trim(($lead['first_name']??'').' '.($lead['last_name']??''));
    $company = $lead['company'] ?? '';
    $title   = $lead['title'] ?? '';
    $industry= $lead['industry'] ?? '';

    $prompts = [
        'linkedin_post' => "Write a LinkedIn post (150-250 words) that would resonate with {$name}, a {$title} at {$company} in the {$industry} industry. The post should provide value, demonstrate expertise, and subtly position this service: {$product}. Tone: {$tone}. Do NOT mention {$name} directly — write it as a general valuable post they would engage with. End with a question or CTA.",
        'connection_request' => "Write a LinkedIn connection request message (under 300 characters) to {$name}, {$title} at {$company}. Make it personal, relevant, and not salesy. Mention something specific about their role or industry ({$industry}). Product context: {$product}.",
        'follow_up' => "Write a LinkedIn follow-up message (2-3 sentences) to {$name}, {$title} at {$company}. They accepted your connection request. Start a genuine conversation related to their industry ({$industry}). Subtly reference: {$product}. Be conversational and warm.",
    ];

    $prompt = $prompts[$type] ?? $prompts['linkedin_post'];

    // Read OpenAI key from key-value settings table
    $apiKeyRow = DB::one("SELECT value FROM settings WHERE key_name='openai_key'");
    $apiKey = $apiKeyRow['value'] ?? getenv('OPENAI_API_KEY') ?? '';
    if (!$apiKey) Response::json(['error'=>'OpenAI API key not configured in Settings → API Keys'], 400);

    $ch = curl_init('https://api.openai.com/v1/chat/completions');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer '.$apiKey, 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode([
            'model' => 'gpt-4o-mini',
            'messages' => [['role'=>'user','content'=>$prompt]],
            'max_tokens' => 400,
        ]),
    ]);
    $r = json_decode(curl_exec($ch), true); curl_close($ch);
    $message = $r['choices'][0]['message']['content'] ?? '';
    if (!$message) Response::json(['error'=>'AI generation failed'], 500);

    DB::update('lead_outreach', ['ai_message'=>$message, 'status'=>'draft'], 'id=?', [$leadId]);
    Response::ok(['message'=>$message, 'lead_id'=>$leadId]);
});

$router->post('/lead-outreach/schedule', function() {
    Auth::require(); $u = Auth::user();
    $b = json_decode(file_get_contents('php://input'), true) ?? [];
    $leadId = (int)($b['lead_id'] ?? 0);
    $scheduledAt = $b['scheduled_at'] ?? date('Y-m-d H:i:s', time()+3600);

    $lead = DB::one('SELECT * FROM lead_outreach WHERE id=? AND user_id=?', [$leadId, $u['id']]);
    if (!$lead || !$lead['ai_message']) Response::json(['error'=>'No message generated yet'], 400);

    $postId = DB::insert('posts', [
        'author_id'    => $u['id'],
        'site_id'      => $lead['site_id'],
        'caption'      => $lead['ai_message'],
        'status'       => 'scheduled',
        'scheduled_at' => $scheduledAt,
        'ai_generated' => 1,
        'created_at'   => date('Y-m-d H:i:s'),
    ]);

    // Add LinkedIn target
    $li = DB::one("SELECT pc.id, pc.platform_id FROM platform_connections pc
                   JOIN platforms p ON p.id=pc.platform_id
                   WHERE pc.site_id=? AND p.key_name='linkedin' AND pc.connected=1
                   LIMIT 1", [$lead['site_id']]);
    if ($li) {
        DB::insert('post_targets', ['post_id'=>$postId,'platform_id'=>$li['platform_id'],'connection_id'=>$li['id'],'status'=>'pending']);
        DB::insert('publish_queue', ['post_id'=>$postId,'priority'=>5,'fire_at'=>$scheduledAt]);
    }

    DB::update('lead_outreach', ['post_id'=>$postId, 'status'=>'scheduled'], 'id=?', [$leadId]);
    Response::ok(['post_id'=>$postId, 'scheduled_at'=>$scheduledAt], 'Post scheduled to LinkedIn!');
});

$router->delete('/lead-outreach/{id}', function(array $p) {
    Auth::require(); $u = Auth::user();
    DB::run('DELETE FROM lead_outreach WHERE id=? AND user_id=?', [(int)$p['id'], $u['id']]);
    Response::ok(['ok'=>true]);
});


// ═══════════════════════════════════════════════════════════════
// MSDHOST STRIPE WEBHOOK
// ═══════════════════════════════════════════════════════════════
$router->post('/msdhost-webhook', function() {
    $payload = file_get_contents('php://input');
    $event   = json_decode($payload, true) ?? [];
    $type    = $event['type'] ?? '';
    $obj     = $event['data']['object'] ?? [];

    file_put_contents('/tmp/msd_stripe.log', date('c')." EVENT: $type\n", FILE_APPEND);

    if ($type !== 'checkout.session.completed') {
        Response::ok(['received'=>true,'type'=>$type,'action'=>'ignored']);
    }

    $email  = $obj['customer_details']['email'] ?? $obj['customer_email'] ?? '';
    $name   = $obj['customer_details']['name'] ?? 'Customer';
    $domain = $obj['metadata']['domain'] ?? '';
    $plan   = $obj['metadata']['plan'] ?? 'starter';

    file_put_contents('/tmp/msd_stripe.log', date('c')." PAYMENT: $domain ($email)\n", FILE_APPEND);

    if ($domain && $email) {
        $cmd = "nohup /usr/local/bin/provision_wp.sh "
            .escapeshellarg($domain)." "
            .escapeshellarg($email)." "
            .escapeshellarg($name)
            ." >> /tmp/msd_provision.log 2>&1 &";
        exec($cmd);
        file_put_contents('/tmp/msd_provision.log', date('c')." TRIGGERED: $domain\n", FILE_APPEND);
        Response::ok(['received'=>true,'status'=>'provisioning_started','domain'=>$domain]);
    } else {
        Response::ok(['received'=>true,'status'=>'no_domain','email'=>$email]);
    }
});

// ── MCP HTTP Streaming Endpoint ─────────────────────────────────
$router->get('/mcp', function() {
    // MCP SSE streaming endpoint
    $token = str_replace('Bearer ','', $_SERVER['HTTP_AUTHORIZATION']??'');
    $tk = $token ? DB::one('SELECT * FROM api_tokens WHERE token_hash=?',[$token]) : null;
    if (!$tk) { http_response_code(401); echo json_encode(['error'=>'Unauthorized']); exit; }

    header('Content-Type: text/event-stream');
    header('Cache-Control: no-cache');
    header('X-Accel-Buffering: no');
    ob_implicit_flush(true);

    // Send server info
    echo "data: " . json_encode(['jsonrpc'=>'2.0','method'=>'initialize','params'=>['protocolVersion'=>'2024-11-05','serverInfo'=>['name'=>'FlowPost MCP','version'=>'1.0.0'],'capabilities'=>['tools'=>[]]]]) . "\n\n";
    flush();
});

$router->post('/mcp', function() {
    $token = str_replace('Bearer ','', $_SERVER['HTTP_AUTHORIZATION']??'');
    $tk = $token ? DB::one('SELECT * FROM api_tokens WHERE token_hash=?',[$token]) : null;
    if (!$tk) { http_response_code(401); echo json_encode(['error'=>'Unauthorized']); exit; }

    $b = body(); $id = $b['id']??null; $method = $b['method']??'';

    if ($method === 'initialize') {
        Response::json(['jsonrpc'=>'2.0','id'=>$id,'result'=>['protocolVersion'=>'2024-11-05','serverInfo'=>['name'=>'FlowPost MCP','version'=>'1.0.0'],'capabilities'=>['tools'=>['listChanged'=>false]]]]);
    } elseif ($method === 'tools/list') {
        Response::json(['jsonrpc'=>'2.0','id'=>$id,'result'=>['tools'=>[
            ['name'=>'create_post','description'=>'Create and schedule a social media post','inputSchema'=>['type'=>'object','properties'=>['caption'=>['type'=>'string'],'site_id'=>['type'=>'integer'],'connection_ids'=>['type'=>'array','items'=>['type'=>'string']],'scheduled_at'=>['type'=>'string','description'=>'ISO 8601 datetime']],'required'=>['caption','site_id']]],
            ['name'=>'list_posts','description'=>'List recent posts','inputSchema'=>['type'=>'object','properties'=>['site_id'=>['type'=>'integer'],'limit'=>['type'=>'integer','default'=>10]]]],
            ['name'=>'list_connections','description'=>'List all connected social media accounts','inputSchema'=>['type'=>'object','properties'=>[]]],
            ['name'=>'list_sites','description'=>'List all sites/brands','inputSchema'=>['type'=>'object','properties'=>[]]],
            ['name'=>'get_analytics','description'=>'Get post analytics for a site','inputSchema'=>['type'=>'object','properties'=>['site_id'=>['type'=>'integer']]]],
        ]]]);
    } elseif ($method === 'tools/call') {
        $name = $b['params']['name']??'';
        $args = $b['params']['arguments']??[];
        $uid = $tk['user_id']??1;

        if ($name === 'create_post') {
            require_once __DIR__.'/models/PostModel.php';
            $pid = PostModel::create(['user_id'=>$uid,'site_id'=>(int)($args['site_id']??1),'caption'=>$args['caption']??'','status'=>isset($args['scheduled_at'])?'scheduled':'draft','connection_ids'=>json_encode($args['connection_ids']??[]),'scheduled_at'=>$args['scheduled_at']??null]);
            Response::json(['jsonrpc'=>'2.0','id'=>$id,'result'=>['content'=>[['type'=>'text','text'=>"Post created with ID: $pid. Status: ".(isset($args['scheduled_at'])?'Scheduled for '.$args['scheduled_at']:'Draft')]]]]);
        } elseif ($name === 'list_posts') {
            $posts = DB::all('SELECT id,caption,status,scheduled_at,created_at FROM posts WHERE site_id=? ORDER BY id DESC LIMIT ?',[(int)($args['site_id']??1),(int)($args['limit']??10)]);
            Response::json(['jsonrpc'=>'2.0','id'=>$id,'result'=>['content'=>[['type'=>'text','text'=>json_encode($posts,JSON_PRETTY_PRINT)]]]]);
        } elseif ($name === 'list_connections') {
            $conns = DB::all('SELECT pc.id,pc.account_name,pc.site_id,p.key_name FROM platform_connections pc JOIN platforms p ON p.id=pc.platform_id WHERE pc.connected=1');
            Response::json(['jsonrpc'=>'2.0','id'=>$id,'result'=>['content'=>[['type'=>'text','text'=>json_encode($conns,JSON_PRETTY_PRINT)]]]]);
        } elseif ($name === 'list_sites') {
            $sites = DB::all('SELECT id,name FROM sites ORDER BY id');
            Response::json(['jsonrpc'=>'2.0','id'=>$id,'result'=>['content'=>[['type'=>'text','text'=>json_encode($sites,JSON_PRETTY_PRINT)]]]]);
        } elseif ($name === 'get_analytics') {
            $posts = DB::all('SELECT status,COUNT(*) as count FROM posts WHERE site_id=? GROUP BY status',[(int)($args['site_id']??1)]);
            Response::json(['jsonrpc'=>'2.0','id'=>$id,'result'=>['content'=>[['type'=>'text','text'=>json_encode($posts,JSON_PRETTY_PRINT)]]]]);
        } else {
            Response::json(['jsonrpc'=>'2.0','id'=>$id,'error'=>['code'=>-32601,'message'=>'Method not found']]);
        }
    } else {
        Response::json(['jsonrpc'=>'2.0','id'=>$id,'result'=>[]]);
    }
});


// ── Disabled legacy text broadcast ───────────────────────────

// ── WhatsApp Direct Broadcast ─────────────────────────────────
$router->post('/whatsapp/broadcast', function() {
    Auth::require();
    $b = body();
    $connId   = (int)($b['connection_id'] ?? 0);
    $message  = trim($b['message'] ?? '');
    $imageUrl = $b['image_url'] ?? null;

    if (!$message) Response::json(['error'=>'Message required'], 400);
    if (!$connId)  Response::json(['error'=>'Connection required'], 400);

    $conn = DB::one('SELECT * FROM platform_connections WHERE id=?', [$connId]);
    if (!$conn) Response::json(['error'=>'Connection not found'], 404);

    $token     = Crypto::dec($conn['access_token']);
    $channelId = $conn['account_id'];

    // Get token from settings
    $waToken = $token ?: DB::one("SELECT value FROM settings WHERE key_name='whatsapp_token'")['value'] ?? getenv('WHATSAPP_TOKEN');
    if (!$waToken) Response::json(['error'=>'WhatsApp token not configured'], 400);

    // Get phone number ID from settings
    $phoneId = DB::one("SELECT value FROM settings WHERE key_name='whatsapp_phone_id'")['value'] ?? getenv('WHATSAPP_PHONE_ID') ?? '';

    // Build payload
    if ($imageUrl) {
        $payload = ['messaging_product'=>'whatsapp','to'=>$channelId,'type'=>'image','image'=>['link'=>$imageUrl,'caption'=>$message]];
    } else {
        $payload = ['messaging_product'=>'whatsapp','to'=>$channelId,'type'=>'text','text'=>['body'=>$message,'preview_url'=>true]];
    }

    // Send via WhatsApp Cloud API
    $url = "https://graph.facebook.com/v19.0/{$phoneId}/messages";
    $ch  = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_HTTPHEADER => ["Authorization: Bearer $waToken", 'Content-Type: application/json'],
        CURLOPT_TIMEOUT => 20,
    ]);
    $r = json_decode(curl_exec($ch), true); curl_close($ch);

    if (isset($r['messages'])) Response::ok(['message_id'=>$r['messages'][0]['id']], 'WhatsApp message sent!');
    Response::json(['error'=>$r['error']['message']??'WhatsApp send failed','raw'=>$r], 400);
});

// ── Disabled legacy text recipients ──────────────────────────


// ═══════════════════════════════════════════════════════════════
// AI CONTENT CALENDAR
// ═══════════════════════════════════════════════════════════════
$router->get('/ai-calendars', function() {
    Auth::require(); $u=Auth::user();
    $siteId=(int)($_GET['site_id']??0);
    $rows=$siteId ? DB::all('SELECT * FROM ai_calendars WHERE site_id=? AND user_id=? AND active=1 ORDER BY id DESC',[$siteId,$u['id']]) : DB::all('SELECT * FROM ai_calendars WHERE user_id=? AND active=1 ORDER BY id DESC',[$u['id']]);
    Response::ok($rows);
});
$router->post('/ai-calendars', function() {
    Auth::require(); $u=Auth::user(); $b=body();
    $id=DB::insert('ai_calendars',['site_id'=>(int)($b['site_id']??0),'user_id'=>$u['id'],'name'=>$b['name']??'AI Calendar','topic'=>$b['topic']??'','tone'=>$b['tone']??'engaging','days'=>(int)($b['days']??30),'post_times'=>json_encode($b['post_times']??['09:00']),'connection_ids'=>json_encode($b['connection_ids']??[]),'status'=>'pending','active'=>1]);
    Response::ok(DB::one('SELECT * FROM ai_calendars WHERE id=?',[$id]));
});
$router->post('/ai-calendars/{id}/generate', function(array $p) {
    Auth::require(); $u=Auth::user();
    $cal=DB::one('SELECT * FROM ai_calendars WHERE id=?',[(int)$p['id']]);
    if(!$cal) Response::json(['error'=>'Not found'],404);
    DB::update('ai_calendars',['status'=>'generating'],'id=?',[$cal['id']]);
    $openaiKey=getenv('OPENAI_API_KEY')?:DB::one("SELECT value FROM settings WHERE key_name='openai_api_key'")['value']??'';
    if(!$openaiKey){DB::update('ai_calendars',['status'=>'pending'],'id=?',[$cal['id']]);Response::json(['error'=>'OpenAI API key not configured'],400);}
    $days=(int)$cal['days']; $topic=$cal['topic']; $tone=$cal['tone'];
    $prompt="Generate $days unique social media post ideas about: \"$topic\". Tone: $tone. Return a JSON array of objects with keys: \"day\" (1-$days), \"caption\" (the full post with hashtags). Each post should be different, engaging, and platform-ready. Return ONLY valid JSON array.";
    $ch=curl_init('https://api.openai.com/v1/chat/completions');
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_POST=>true,CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: Bearer '.$openaiKey],CURLOPT_POSTFIELDS=>json_encode(['model'=>'gpt-4o-mini','messages'=>[['role'=>'user','content'=>$prompt]],'max_tokens'=>4000]),CURLOPT_TIMEOUT=>60]);
    $r=json_decode(curl_exec($ch),true);curl_close($ch);
    $text=$r['choices'][0]['message']['content']??'';
    // Extract JSON from response
    preg_match('/\[[\s\S]*\]/',$text,$m);
    $posts=json_decode($m[0]??'[]',true)??[];
    $connIds=json_decode($cal['connection_ids']??'[]',true)??[];
    $times=json_decode($cal['post_times']??'["09:00"]',true)??['09:00'];
    $generated=0;
    foreach($posts as $i=>$post){
        $day=$post['day']??($i+1);
        $caption=$post['caption']??'';
        if(!$caption) continue;
        $schedDate=date('Y-m-d',strtotime("+$day days")).' '.($times[$i%count($times)]??'09:00').':00';
        $pid=DB::insert('posts',['author_id'=>$u['id'],'site_id'=>(int)$cal['site_id'],'caption'=>$caption,'status'=>'scheduled','scheduled_at'=>$schedDate,'ai_generated'=>1]);
        foreach($connIds as $cid){
            $conn=DB::one('SELECT id,platform_id FROM platform_connections WHERE id=?',[(int)$cid]);
            if($conn) DB::insert('post_targets',['post_id'=>$pid,'platform_id'=>$conn['platform_id'],'connection_id'=>$conn['id'],'status'=>'pending']);
        }
        if(!empty($connIds)){
            DB::insert('publish_queue',['post_id'=>$pid,'fire_at'=>$schedDate,'priority'=>3]);
        }
        $generated++;
    }
    DB::update('ai_calendars',['status'=>'active','posts_generated'=>$generated],'id=?',[$cal['id']]);
    Response::ok(['generated'=>$generated,'calendar_id'=>$cal['id']],"Generated $generated posts!");
});
$router->delete('/ai-calendars/{id}', function(array $p) {
    Auth::require(); DB::update('ai_calendars',['active'=>0],'id=?',[(int)$p['id']]); Response::ok(['ok'=>true]);
});

// ═══════════════════════════════════════════════════════════════
// RECURRING POSTS
// ═══════════════════════════════════════════════════════════════
$router->get('/recurring-posts', function() {
    Auth::require(); $u=Auth::user();
    $siteId=(int)($_GET['site_id']??0);
    $rows=$siteId ? DB::all('SELECT * FROM recurring_posts WHERE site_id=? AND user_id=? AND active=1 ORDER BY id DESC',[$siteId,$u['id']]) : DB::all('SELECT * FROM recurring_posts WHERE user_id=? AND active=1 ORDER BY id DESC',[$u['id']]);
    Response::ok($rows);
});
$router->post('/recurring-posts', function() {
    Auth::require(); $u=Auth::user(); $b=body();
    $id=DB::insert('recurring_posts',['site_id'=>(int)($b['site_id']??0),'user_id'=>$u['id'],'name'=>$b['name']??'Recurring Post','caption'=>$b['caption']??'','connection_ids'=>json_encode($b['connection_ids']??[]),'frequency'=>$b['frequency']??'daily','post_time'=>$b['post_time']??'07:00','day_of_week'=>isset($b['day_of_week'])?(int)$b['day_of_week']:null,'active'=>1]);
    Response::ok(DB::one('SELECT * FROM recurring_posts WHERE id=?',[$id]));
});
$router->put('/recurring-posts/{id}', function(array $p) {
    Auth::require(); $b=body();
    DB::update('recurring_posts',['name'=>$b['name']??'','caption'=>$b['caption']??'','connection_ids'=>json_encode($b['connection_ids']??[]),'frequency'=>$b['frequency']??'daily','post_time'=>$b['post_time']??'07:00','active'=>(int)($b['active']??1)],'id=?',[(int)$p['id']]);
    Response::ok(['ok'=>true]);
});
$router->delete('/recurring-posts/{id}', function(array $p) {
    Auth::require(); DB::update('recurring_posts',['active'=>0],'id=?',[(int)$p['id']]); Response::ok(['ok'=>true]);
});

// ═══════════════════════════════════════════════════════════════
// EVERGREEN RECYCLER
// ═══════════════════════════════════════════════════════════════
$router->get('/evergreen', function() {
    Auth::require(); $u=Auth::user();
    Response::ok(DB::all('SELECT * FROM evergreen_queues WHERE user_id=? AND active=1 ORDER BY id DESC',[$u['id']]));
});
$router->post('/evergreen', function() {
    Auth::require(); $u=Auth::user(); $b=body();
    $id=DB::insert('evergreen_queues',['site_id'=>(int)($b['site_id']??0),'user_id'=>$u['id'],'name'=>$b['name']??'Evergreen','connection_ids'=>json_encode($b['connection_ids']??[]),'min_age_days'=>(int)($b['min_age_days']??30),'post_time'=>$b['post_time']??'09:00','frequency'=>$b['frequency']??'weekly','active'=>1]);
    Response::ok(DB::one('SELECT * FROM evergreen_queues WHERE id=?',[$id]));
});
$router->post('/evergreen/{id}/run', function(array $p) {
    Auth::require();
    $eq=DB::one('SELECT * FROM evergreen_queues WHERE id=?',[(int)$p['id']]);
    if(!$eq) Response::json(['error'=>'Not found'],404);
    $minAge=$eq['min_age_days']??30;
    $oldPost=DB::one("SELECT * FROM posts WHERE site_id=? AND status='published' AND published_at < (NOW() - INTERVAL ? DAY) AND id NOT IN (SELECT DISTINCT post_id FROM publish_queue) ORDER BY RAND() LIMIT 1",[(int)$eq['site_id'],$minAge]);
    if(!$oldPost) Response::json(['error'=>'No eligible old posts found'],404);
    $connIds=json_decode($eq['connection_ids']??'[]',true)??[];
    $pid=DB::insert('posts',['author_id'=>1,'site_id'=>(int)$eq['site_id'],'caption'=>$oldPost['caption'],'status'=>'scheduled','scheduled_at'=>date('Y-m-d').' '.$eq['post_time'].':00','ai_generated'=>0]);
    foreach($connIds as $cid){
        $conn=DB::one('SELECT id,platform_id FROM platform_connections WHERE id=?',[(int)$cid]);
        if($conn) DB::insert('post_targets',['post_id'=>$pid,'platform_id'=>$conn['platform_id'],'connection_id'=>$conn['id'],'status'=>'pending']);
    }
    DB::insert('publish_queue',['post_id'=>$pid,'fire_at'=>date('Y-m-d').' '.$eq['post_time'].':00','priority'=>4]);
    DB::update('evergreen_queues',['last_posted_at'=>date('Y-m-d H:i:s')],'id=?',[(int)$eq['id']]);
    Response::ok(['post_id'=>$pid,'original_id'=>$oldPost['id']],'Recycled post queued!');
});
$router->delete('/evergreen/{id}', function(array $p) {
    Auth::require(); DB::update('evergreen_queues',['active'=>0],'id=?',[(int)$p['id']]); Response::ok(['ok'=>true]);
});

// ═══════════════════════════════════════════════════════════════
// PRODUCT FEEDS (WooCommerce)
// ═══════════════════════════════════════════════════════════════
$router->get('/product-feeds', function() {
    Auth::require(); $u=Auth::user();
    Response::ok(DB::all('SELECT * FROM product_feeds WHERE user_id=? AND active=1 ORDER BY id DESC',[$u['id']]));
});
$router->post('/product-feeds', function() {
    Auth::require(); $u=Auth::user(); $b=body();
    $id=DB::insert('product_feeds',['site_id'=>(int)($b['site_id']??0),'user_id'=>$u['id'],'name'=>$b['name']??'Product Feed','store_url'=>rtrim($b['store_url']??'','/'),'api_key'=>$b['api_key']??null,'api_secret'=>$b['api_secret']??null,'connection_ids'=>json_encode($b['connection_ids']??[]),'frequency'=>$b['frequency']??'daily','post_time'=>$b['post_time']??'10:00','ai_tone'=>$b['ai_tone']??'promotional','ai_instructions'=>$b['ai_instructions']??null,'active'=>1]);
    Response::ok(DB::one('SELECT * FROM product_feeds WHERE id=?',[$id]));
});
$router->post('/product-feeds/{id}/run', function(array $p) {
    Auth::require(); $u=Auth::user();
    $pf=DB::one('SELECT * FROM product_feeds WHERE id=?',[(int)$p['id']]);
    if(!$pf) Response::json(['error'=>'Not found'],404);
    $url=$pf['store_url'].'/wp-json/wc/v3/products?per_page=5&orderby=rand';
    $ch=curl_init($url);
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_USERPWD=>$pf['api_key'].':'.$pf['api_secret'],CURLOPT_TIMEOUT=>20]);
    $products=json_decode(curl_exec($ch),true);curl_close($ch);
    if(empty($products)||isset($products['code'])) Response::json(['error'=>'Could not fetch products: '.($products['message']??'check API keys')],400);
    $openaiKey=getenv('OPENAI_API_KEY')?:DB::one("SELECT value FROM settings WHERE key_name='openai_api_key'")['value']??'';
    $connIds=json_decode($pf['connection_ids']??'[]',true)??[];
    $created=0;
    foreach(array_slice($products,0,1) as $product){
        $name=$product['name']??''; $price=$product['price']??''; $desc=strip_tags($product['short_description']??$product['description']??''); $link=$product['permalink']??''; $img=$product['images'][0]['src']??null;
        if($openaiKey){
            $extra=$pf['ai_instructions']?"\nExtra: ".$pf['ai_instructions']:'';
            $prompt="Write a {$pf['ai_tone']} social media post promoting this product.$extra\nProduct: $name\nPrice: \$$price\nDescription: ".substr($desc,0,300)."\nLink: $link\nInclude relevant hashtags and end with the product URL.";
            $ch2=curl_init('https://api.openai.com/v1/chat/completions');
            curl_setopt_array($ch2,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_POST=>true,CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: Bearer '.$openaiKey],CURLOPT_POSTFIELDS=>json_encode(['model'=>'gpt-4o-mini','messages'=>[['role'=>'user','content'=>$prompt]],'max_tokens'=>300]),CURLOPT_TIMEOUT=>30]);
            $r=json_decode(curl_exec($ch2),true);curl_close($ch2);
            $caption=trim($r['choices'][0]['message']['content']??'');
        } else {
            $caption="$name — $$price\n\n$desc\n\nShop now: $link";
        }
        $pid=DB::insert('posts',['author_id'=>$u['id'],'site_id'=>(int)$pf['site_id'],'caption'=>$caption,'link_url'=>$link,'status'=>'queued','scheduled_at'=>date('Y-m-d').' '.$pf['post_time'].':00','ai_generated'=>$openaiKey?1:0]);
        foreach($connIds as $cid){
            $conn=DB::one('SELECT id,platform_id FROM platform_connections WHERE id=?',[(int)$cid]);
            if($conn) DB::insert('post_targets',['post_id'=>$pid,'platform_id'=>$conn['platform_id'],'connection_id'=>$conn['id'],'status'=>'pending']);
        }
        DB::insert('publish_queue',['post_id'=>$pid,'fire_at'=>date('Y-m-d H:i:s'),'priority'=>2]);
        DB::update('product_feeds',['last_posted_at'=>date('Y-m-d H:i:s')],'id=?',[(int)$pf['id']]);
        $created++;
    }
    Response::ok(['created'=>$created],"$created product post(s) queued!");
});
$router->delete('/product-feeds/{id}', function(array $p) {
    Auth::require(); DB::update('product_feeds',['active'=>0],'id=?',[(int)$p['id']]); Response::ok(['ok'=>true]);
});


// ═══════════════════════════════════════════════════════════════
// SCRIPTURE / QUOTE OF THE DAY
// ═══════════════════════════════════════════════════════════════
$router->get('/quote-schedules', function() {
    Auth::require(); $u=Auth::user();
    Response::ok(DB::all('SELECT * FROM quote_schedules WHERE user_id=? AND active=1 ORDER BY id DESC',[$u['id']]));
});
$router->post('/quote-schedules', function() {
    Auth::require(); $u=Auth::user(); $b=body();
    $id=DB::insert('quote_schedules',['site_id'=>(int)($b['site_id']??0),'user_id'=>$u['id'],'name'=>$b['name']??'Daily Quote','type'=>$b['type']??'scripture','custom_quotes'=>isset($b['custom_quotes'])?json_encode($b['custom_quotes']):null,'connection_ids'=>json_encode($b['connection_ids']??[]),'post_time'=>$b['post_time']??'06:00','tone'=>$b['tone']??'inspirational','ai_instructions'=>$b['ai_instructions']??null,'active'=>1]);
    Response::ok(DB::one('SELECT * FROM quote_schedules WHERE id=?',[$id]));
});
$router->delete('/quote-schedules/{id}', function(array $p) {
    Auth::require(); DB::update('quote_schedules',['active'=>0],'id=?',[(int)$p['id']]); Response::ok(['ok'=>true]);
});

// ═══════════════════════════════════════════════════════════════
// HOLIDAY / CHURCH CALENDAR
// ═══════════════════════════════════════════════════════════════
$router->get('/calendar-posts', function() {
    Auth::require(); $u=Auth::user();
    Response::ok(DB::all('SELECT * FROM calendar_posts WHERE user_id=? AND active=1 ORDER BY id DESC',[$u['id']]));
});
$router->post('/calendar-posts', function() {
    Auth::require(); $u=Auth::user(); $b=body();
    $id=DB::insert('calendar_posts',['site_id'=>(int)($b['site_id']??0),'user_id'=>$u['id'],'name'=>$b['name']??'Holiday Posts','event_type'=>$b['event_type']??'christian','connection_ids'=>json_encode($b['connection_ids']??[]),'tone'=>$b['tone']??'inspirational','ai_instructions'=>$b['ai_instructions']??null,'days_before'=>(int)($b['days_before']??0),'active'=>1]);
    Response::ok(DB::one('SELECT * FROM calendar_posts WHERE id=?',[$id]));
});
$router->delete('/calendar-posts/{id}', function(array $p) {
    Auth::require(); DB::update('calendar_posts',['active'=>0],'id=?',[(int)$p['id']]); Response::ok(['ok'=>true]);
});

// ═══════════════════════════════════════════════════════════════
// TESTIMONIAL ROTATOR
// ═══════════════════════════════════════════════════════════════
$router->get('/testimonials', function() {
    Auth::require(); $u=Auth::user();
    Response::ok(DB::all('SELECT * FROM testimonial_queues WHERE user_id=? AND active=1 ORDER BY id DESC',[$u['id']]));
});
$router->post('/testimonials', function() {
    Auth::require(); $u=Auth::user(); $b=body();
    $id=DB::insert('testimonial_queues',['site_id'=>(int)($b['site_id']??0),'user_id'=>$u['id'],'name'=>$b['name']??'Testimonials','testimonials'=>json_encode($b['testimonials']??[]),'connection_ids'=>json_encode($b['connection_ids']??[]),'frequency'=>$b['frequency']??'weekly','post_time'=>$b['post_time']??'10:00','active'=>1]);
    Response::ok(DB::one('SELECT * FROM testimonial_queues WHERE id=?',[$id]));
});
$router->post('/testimonials/{id}/run', function(array $p) {
    Auth::require();
    $tq=DB::one('SELECT * FROM testimonial_queues WHERE id=?',[(int)$p['id']]);
    if(!$tq) Response::json(['error'=>'Not found'],404);
    $testimonials=json_decode($tq['testimonials']??'[]',true);
    if(empty($testimonials)) Response::json(['error'=>'No testimonials added yet'],400);
    $t=$testimonials[array_rand($testimonials)];
    $caption="⭐⭐⭐⭐⭐\n\n\"{$t['text']}\"\n— {$t['name']}".($t['location']?", {$t['location']}":'');
    $connIds=json_decode($tq['connection_ids']??'[]',true)??[];
    $pid=DB::insert('posts',['author_id'=>1,'site_id'=>(int)$tq['site_id'],'caption'=>$caption,'status'=>'queued','scheduled_at'=>date('Y-m-d H:i:s'),'ai_generated'=>0]);
    foreach($connIds as $cid){$conn=DB::one('SELECT id,platform_id FROM platform_connections WHERE id=?',[(int)$cid]);if($conn)DB::insert('post_targets',['post_id'=>$pid,'platform_id'=>$conn['platform_id'],'connection_id'=>$conn['id'],'status'=>'pending']);}
    DB::insert('publish_queue',['post_id'=>$pid,'fire_at'=>date('Y-m-d H:i:s'),'priority'=>3]);
    DB::update('testimonial_queues',['last_posted_at'=>date('Y-m-d H:i:s')],'id=?',[(int)$tq['id']]);
    Response::ok(['post_id'=>$pid],'Testimonial queued!');
});
$router->delete('/testimonials/{id}', function(array $p) {
    Auth::require(); DB::update('testimonial_queues',['active'=>0],'id=?',[(int)$p['id']]); Response::ok(['ok'=>true]);
});

// ═══════════════════════════════════════════════════════════════
// LEAD MAGNET ROTATOR
// ═══════════════════════════════════════════════════════════════
$router->get('/lead-magnets', function() {
    Auth::require(); $u=Auth::user();
    Response::ok(DB::all('SELECT * FROM lead_magnet_queues WHERE user_id=? AND active=1 ORDER BY id DESC',[$u['id']]));
});
$router->post('/lead-magnets', function() {
    Auth::require(); $u=Auth::user(); $b=body();
    $id=DB::insert('lead_magnet_queues',['site_id'=>(int)($b['site_id']??0),'user_id'=>$u['id'],'name'=>$b['name']??'Lead Magnets','magnets'=>json_encode($b['magnets']??[]),'connection_ids'=>json_encode($b['connection_ids']??[]),'frequency'=>$b['frequency']??'weekly','post_time'=>$b['post_time']??'09:00','ai_tone'=>$b['ai_tone']??'promotional','active'=>1]);
    Response::ok(DB::one('SELECT * FROM lead_magnet_queues WHERE id=?',[$id]));
});
$router->post('/lead-magnets/{id}/run', function(array $p) {
    Auth::require(); $u=Auth::user();
    $lm=DB::one('SELECT * FROM lead_magnet_queues WHERE id=?',[(int)$p['id']]);
    if(!$lm) Response::json(['error'=>'Not found'],404);
    $magnets=json_decode($lm['magnets']??'[]',true);
    if(empty($magnets)) Response::json(['error'=>'No lead magnets added yet'],400);
    $m=$magnets[array_rand($magnets)];
    $openaiKey=getenv('OPENAI_API_KEY')?:DB::one("SELECT value FROM settings WHERE key_name='openai_api_key'")['value']??'';
    if($openaiKey){
        $prompt="Write a {$lm['ai_tone']} social media post promoting this free resource:\nTitle: {$m['title']}\nDescription: {$m['description']}\nLink: {$m['url']}\nHighlight it's FREE and include a clear call to action. Add relevant hashtags.";
        $ch=curl_init('https://api.openai.com/v1/chat/completions');
        curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_POST=>true,CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: Bearer '.$openaiKey],CURLOPT_POSTFIELDS=>json_encode(['model'=>'gpt-4o-mini','messages'=>[['role'=>'user','content'=>$prompt]],'max_tokens'=>300]),CURLOPT_TIMEOUT=>30]);
        $r=json_decode(curl_exec($ch),true);curl_close($ch);
        $caption=trim($r['choices'][0]['message']['content']??'');
    } else {
        $caption="FREE: {$m['title']}\n\n{$m['description']}\n\nGet it here: {$m['url']}";
    }
    $connIds=json_decode($lm['connection_ids']??'[]',true)??[];
    $pid=DB::insert('posts',['author_id'=>$u['id'],'site_id'=>(int)$lm['site_id'],'caption'=>$caption,'link_url'=>$m['url']??null,'status'=>'queued','scheduled_at'=>date('Y-m-d H:i:s'),'ai_generated'=>$openaiKey?1:0]);
    foreach($connIds as $cid){$conn=DB::one('SELECT id,platform_id FROM platform_connections WHERE id=?',[(int)$cid]);if($conn)DB::insert('post_targets',['post_id'=>$pid,'platform_id'=>$conn['platform_id'],'connection_id'=>$conn['id'],'status'=>'pending']);}
    DB::insert('publish_queue',['post_id'=>$pid,'fire_at'=>date('Y-m-d H:i:s'),'priority'=>2]);
    DB::update('lead_magnet_queues',['last_posted_at'=>date('Y-m-d H:i:s')],'id=?',[(int)$lm['id']]);
    Response::ok(['post_id'=>$pid],'Lead magnet post queued!');
});
$router->delete('/lead-magnets/{id}', function(array $p) {
    Auth::require(); DB::update('lead_magnet_queues',['active'=>0],'id=?',[(int)$p['id']]); Response::ok(['ok'=>true]);
});

// ═══════════════════════════════════════════════════════════════
// EVENT COUNTDOWN
// ═══════════════════════════════════════════════════════════════
$router->get('/event-countdowns', function() {
    Auth::require(); $u=Auth::user();
    Response::ok(DB::all('SELECT * FROM event_countdowns WHERE user_id=? AND active=1 ORDER BY event_date ASC',[$u['id']]));
});
$router->post('/event-countdowns', function() {
    Auth::require(); $u=Auth::user(); $b=body();
    $days=$b['post_days']??[30,14,7,3,2,1];
    $id=DB::insert('event_countdowns',['site_id'=>(int)($b['site_id']??0),'user_id'=>$u['id'],'name'=>$b['name']??'Event','event_name'=>$b['event_name']??'','event_date'=>$b['event_date']??date('Y-m-d'),'event_url'=>$b['event_url']??null,'connection_ids'=>json_encode($b['connection_ids']??[]),'post_days'=>json_encode($days),'post_time'=>$b['post_time']??'09:00','tone'=>$b['tone']??'exciting','ai_instructions'=>$b['ai_instructions']??null,'active'=>1]);
    Response::ok(DB::one('SELECT * FROM event_countdowns WHERE id=?',[$id]));
});
$router->delete('/event-countdowns/{id}', function(array $p) {
    Auth::require(); DB::update('event_countdowns',['active'=>0],'id=?',[(int)$p['id']]); Response::ok(['ok'=>true]);
});

// ═══════════════════════════════════════════════════════════════
// YOUTUBE AUTO-POST
// ═══════════════════════════════════════════════════════════════
$router->get('/youtube-autoposts', function() {
    Auth::require(); $u=Auth::user();
    Response::ok(DB::all('SELECT * FROM youtube_autoposts WHERE user_id=? AND active=1 ORDER BY id DESC',[$u['id']]));
});
$router->post('/youtube-autoposts', function() {
    Auth::require(); $u=Auth::user(); $b=body();
    $id=DB::insert('youtube_autoposts',['site_id'=>(int)($b['site_id']??0),'user_id'=>$u['id'],'name'=>$b['name']??'YouTube Feed','channel_id'=>$b['channel_id']??'','connection_ids'=>json_encode($b['connection_ids']??[]),'tone'=>$b['tone']??'engaging','ai_instructions'=>$b['ai_instructions']??null,'active'=>1]);
    Response::ok(DB::one('SELECT * FROM youtube_autoposts WHERE id=?',[$id]));
});
$router->post('/youtube-autoposts/{id}/check', function(array $p) {
    Auth::require();
    $ya=DB::one('SELECT * FROM youtube_autoposts WHERE id=?',[(int)$p['id']]);
    if(!$ya) Response::json(['error'=>'Not found'],404);
    $channelId=$ya['channel_id'];
    $apiKey=DB::one("SELECT value FROM settings WHERE key_name='youtube_data_api_key'")['value']??getenv('YOUTUBE_DATA_API_KEY')?:'';
    $url="https://www.googleapis.com/youtube/v3/search?channelId={$channelId}&part=snippet&order=date&maxResults=1&type=video".($apiKey?"&key={$apiKey}":'');
    $ch=curl_init($url);curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>15]);
    $r=json_decode(curl_exec($ch),true);curl_close($ch);
    $items=$r['items']??[];
    if(empty($items)) Response::json(['error'=>'No videos found or API key missing'],400);
    $vid=$items[0];$videoId=$vid['id']['videoId']??'';
    if(!$videoId||$videoId===$ya['last_video_id']) Response::ok(['new'=>false],'No new video');
    $title=$vid['snippet']['title']??''; $desc=substr($vid['snippet']['description']??'',0,300); $link="https://youtube.com/watch?v=$videoId";
    $openaiKey=getenv('OPENAI_API_KEY')?:DB::one("SELECT value FROM settings WHERE key_name='openai_api_key'")['value']??'';
    if($openaiKey){
        $instr=$ya['ai_instructions']?"\n".$ya['ai_instructions']:'';
        $prompt="Write a {$ya['tone']} social media post announcing this new YouTube video.$instr\nTitle: $title\nDescription: $desc\nLink: $link\nMake it exciting and include hashtags.";
        $ch2=curl_init('https://api.openai.com/v1/chat/completions');
        curl_setopt_array($ch2,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_POST=>true,CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: Bearer '.$openaiKey],CURLOPT_POSTFIELDS=>json_encode(['model'=>'gpt-4o-mini','messages'=>[['role'=>'user','content'=>$prompt]],'max_tokens'=>300]),CURLOPT_TIMEOUT=>30]);
        $r2=json_decode(curl_exec($ch2),true);curl_close($ch2);
        $caption=trim($r2['choices'][0]['message']['content']??'');
    } else { $caption="New video: $title\n\n$link"; }
    $connIds=json_decode($ya['connection_ids']??'[]',true)??[];
    $pid=DB::insert('posts',['author_id'=>1,'site_id'=>(int)$ya['site_id'],'caption'=>$caption,'link_url'=>$link,'status'=>'queued','scheduled_at'=>date('Y-m-d H:i:s'),'ai_generated'=>$openaiKey?1:0]);
    foreach($connIds as $cid){$conn=DB::one('SELECT id,platform_id FROM platform_connections WHERE id=?',[(int)$cid]);if($conn)DB::insert('post_targets',['post_id'=>$pid,'platform_id'=>$conn['platform_id'],'connection_id'=>$conn['id'],'status'=>'pending']);}
    DB::insert('publish_queue',['post_id'=>$pid,'fire_at'=>date('Y-m-d H:i:s'),'priority'=>1]);
    DB::update('youtube_autoposts',['last_video_id'=>$videoId],'id=?',[(int)$ya['id']]);
    Response::ok(['post_id'=>$pid,'video_id'=>$videoId,'new'=>true],'New video post queued!');
});
$router->delete('/youtube-autoposts/{id}', function(array $p) {
    Auth::require(); DB::update('youtube_autoposts',['active'=>0],'id=?',[(int)$p['id']]); Response::ok(['ok'=>true]);
});

// ═══════════════════════════════════════════════════════════════
// A/B CAPTION TESTER
// ═══════════════════════════════════════════════════════════════
$router->get('/ab-tests', function() {
    Auth::require(); $u=Auth::user();
    Response::ok(DB::all('SELECT * FROM ab_tests WHERE user_id=? AND active=1 ORDER BY id DESC',[$u['id']]));
});
$router->post('/ab-tests', function() {
    Auth::require(); $u=Auth::user(); $b=body();
    $id=DB::insert('ab_tests',['site_id'=>(int)($b['site_id']??0),'user_id'=>$u['id'],'name'=>$b['name']??'A/B Test','caption_a'=>$b['caption_a']??'','caption_b'=>$b['caption_b']??'','connection_ids'=>json_encode($b['connection_ids']??[]),'status'=>'pending','active'=>1]);
    Response::ok(DB::one('SELECT * FROM ab_tests WHERE id=?',[$id]));
});
$router->post('/ab-tests/{id}/run', function(array $p) {
    Auth::require(); $u=Auth::user();
    $ab=DB::one('SELECT * FROM ab_tests WHERE id=?',[(int)$p['id']]);
    if(!$ab) Response::json(['error'=>'Not found'],404);
    $connIds=json_decode($ab['connection_ids']??'[]',true)??[];
    $pidA=DB::insert('posts',['author_id'=>$u['id'],'site_id'=>(int)$ab['site_id'],'caption'=>$ab['caption_a'],'status'=>'queued','scheduled_at'=>date('Y-m-d H:i:s'),'ai_generated'=>0]);
    $pidB=DB::insert('posts',['author_id'=>$u['id'],'site_id'=>(int)$ab['site_id'],'caption'=>$ab['caption_b'],'status'=>'queued','scheduled_at'=>date('Y-m-d',strtotime('+1 day')).' 09:00:00','ai_generated'=>0]);
    foreach($connIds as $cid){
        $conn=DB::one('SELECT id,platform_id FROM platform_connections WHERE id=?',[(int)$cid]);
        if($conn){
            DB::insert('post_targets',['post_id'=>$pidA,'platform_id'=>$conn['platform_id'],'connection_id'=>$conn['id'],'status'=>'pending']);
            DB::insert('post_targets',['post_id'=>$pidB,'platform_id'=>$conn['platform_id'],'connection_id'=>$conn['id'],'status'=>'pending']);
        }
    }
    DB::insert('publish_queue',['post_id'=>$pidA,'fire_at'=>date('Y-m-d H:i:s'),'priority'=>2]);
    DB::insert('publish_queue',['post_id'=>$pidB,'fire_at'=>date('Y-m-d',strtotime('+1 day')).' 09:00:00','priority'=>2]);
    DB::update('ab_tests',['status'=>'running','post_id_a'=>$pidA,'post_id_b'=>$pidB],'id=?',[(int)$ab['id']]);
    Response::ok(['post_id_a'=>$pidA,'post_id_b'=>$pidB],'A/B test running! Version A posts now, Version B posts tomorrow.');
});
$router->delete('/ab-tests/{id}', function(array $p) {
    Auth::require(); DB::update('ab_tests',['active'=>0],'id=?',[(int)$p['id']]); Response::ok(['ok'=>true]);
});


// ── Comment Templates ─────────────────────────────────────────
$router->get('/comment-templates', function() {
    Auth::require(); $u=Auth::user();
    $siteId=(int)($_GET['site_id']??0);
    $rows=$siteId?DB::all('SELECT * FROM comment_templates WHERE site_id=? AND user_id=? AND active=1 ORDER BY category,id',[$siteId,$u['id']]):DB::all('SELECT * FROM comment_templates WHERE user_id=? AND active=1 ORDER BY category,id',[$u['id']]);
    Response::ok($rows);
});
$router->post('/comment-templates', function() {
    Auth::require(); $u=Auth::user(); $b=body();
    $id=DB::insert('comment_templates',['site_id'=>(int)($b['site_id']??0),'user_id'=>$u['id'],'name'=>$b['name']??'Template','category'=>$b['category']??'general','text'=>$b['text']??'','platforms'=>$b['platforms']??'all','active'=>1]);
    Response::ok(DB::one('SELECT * FROM comment_templates WHERE id=?',[$id]));
});
$router->put('/comment-templates/{id}', function(array $p) {
    Auth::require(); $b=body();
    DB::update('comment_templates',['name'=>$b['name']??'','text'=>$b['text']??'','category'=>$b['category']??'general','platforms'=>$b['platforms']??'all'],'id=?',[(int)$p['id']]);
    DB::run('UPDATE comment_templates SET used_count=used_count+1 WHERE id=?',[(int)$p['id']]);
    Response::ok(['ok'=>true]);
});
$router->delete('/comment-templates/{id}', function(array $p) {
    Auth::require(); DB::update('comment_templates',['active'=>0],'id=?',[(int)$p['id']]); Response::ok(['ok'=>true]);
});

// ── Auto Reply Rules ──────────────────────────────────────────
$router->get('/auto-reply-rules', function() {
    Auth::require(); $u=Auth::user();
    Response::ok(DB::all('SELECT * FROM auto_reply_rules WHERE user_id=? AND active=1 ORDER BY id DESC',[$u['id']]));
});
$router->post('/auto-reply-rules', function() {
    Auth::require(); $u=Auth::user(); $b=body();
    $id=DB::insert('auto_reply_rules',['site_id'=>(int)($b['site_id']??0),'user_id'=>$u['id'],'name'=>$b['name']??'Auto Reply','platform'=>$b['platform']??'all','connection_id'=>(int)($b['connection_id']??0),'trigger_keywords'=>json_encode($b['trigger_keywords']??[]),'reply_text'=>$b['reply_text']??'','active'=>1]);
    Response::ok(DB::one('SELECT * FROM auto_reply_rules WHERE id=?',[$id]));
});
$router->delete('/auto-reply-rules/{id}', function(array $p) {
    Auth::require(); DB::update('auto_reply_rules',['active'=>0],'id=?',[(int)$p['id']]); Response::ok(['ok'=>true]);
});


// ── Kling AI Video (JWT Auth) ──────────────────────────────────
function klingJWT(): string {
    $ak = getenv('KLING_ACCESS_KEY') ?: DB::one("SELECT value FROM settings WHERE key_name='kling_access_key'")['value'] ?? '';
    $sk = getenv('KLING_SECRET_KEY') ?: DB::one("SELECT value FROM settings WHERE key_name='kling_secret_key'")['value'] ?? '';
    if (!$ak || !$sk) return '';
    $header  = base64_encode(json_encode(['alg'=>'HS256','typ'=>'JWT']));
    $payload = base64_encode(json_encode(['iss'=>$ak,'exp'=>time()+1800,'nbf'=>time()-5]));
    $header  = rtrim(strtr($header,'+/','-_'),'=');
    $payload = rtrim(strtr($payload,'+/','-_'),'=');
    $sig     = rtrim(strtr(base64_encode(hash_hmac('sha256',"$header.$payload",$sk,true)),'+/','-_'),'=');
    return "$header.$payload.$sig";
}
$router->post('/ai/kling-video', function() {
    Auth::require();
    $b=$body=body(); $prompt=$b['prompt']??''; $duration=(int)($b['duration']??5);
    $jwt=klingJWT();
    if(!$jwt) Response::json(['error'=>'Kling API keys not configured. Add Access Key and Secret Key in Settings.'],400);
    if(!$prompt) Response::json(['error'=>'Prompt required'],400);
    $ch=curl_init('https://api.klingai.com/v1/videos/text2video');
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_POST=>true,CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: Bearer '.$jwt],CURLOPT_POSTFIELDS=>json_encode(['model'=>'kling-v1-5','prompt'=>$prompt,'duration'=>$duration,'aspect_ratio'=>'16:9','mode'=>'pro']),CURLOPT_TIMEOUT=>30]);
    $r=json_decode(curl_exec($ch),true);curl_close($ch);
    if(isset($r['data']['task_id'])) Response::ok(['task_id'=>$r['data']['task_id'],'provider'=>'kling']);
    Response::json(['error'=>'Kling: '.($r['message']??json_encode($r))],500);
});
$router->post('/ai/kling-status', function() {
    Auth::require(); $b=body(); $taskId=$b['task_id']??'';
    $jwt=klingJWT();
    $ch=curl_init("https://api.klingai.com/v1/videos/text2video/{$taskId}");
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$jwt],CURLOPT_TIMEOUT=>15]);
    $r=json_decode(curl_exec($ch),true);curl_close($ch);
    $status=$r['data']['task_status']??'';
    if($status==='succeed'){$url=$r['data']['task_result']['videos'][0]['url']??null;Response::ok(['status'=>'SUCCEEDED','url'=>$url]);}
    Response::ok(['status'=>$status==='failed'?'FAILED':'PENDING']);
});

// ── Luma Dream Machine ─────────────────────────────────────────
$router->post('/ai/luma-video', function() {
    Auth::require();
    $b=body(); $prompt=$b['prompt']??''; $duration=(int)($b['duration']??5);
    $apiKey=getenv('LUMA_API_KEY')?:DB::one("SELECT value FROM settings WHERE key_name='luma_api_key'")['value']??'';
    if(!$apiKey) Response::json(['error'=>'Luma API key not configured. Add it in Settings → API Keys.'],400);
    $ch=curl_init('https://api.lumalabs.ai/dream-machine/v1/generations/video');
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_POST=>true,CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: Bearer '.$apiKey],CURLOPT_POSTFIELDS=>json_encode(['prompt'=>$prompt,'aspect_ratio'=>'16:9','loop'=>false]),CURLOPT_TIMEOUT=>30]);
    $r=json_decode(curl_exec($ch),true);curl_close($ch);
    if(isset($r['id'])) Response::ok(['task_id'=>$r['id'],'provider'=>'luma']);
    Response::json(['error'=>'Luma: '.($r['detail']??json_encode($r))],500);
});
$router->post('/ai/luma-status', function() {
    Auth::require(); $b=body(); $taskId=$b['task_id']??'';
    $apiKey=getenv('LUMA_API_KEY')?:DB::one("SELECT value FROM settings WHERE key_name='luma_api_key'")['value']??'';
    $ch=curl_init("https://api.lumalabs.ai/dream-machine/v1/generations/{$taskId}");
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$apiKey],CURLOPT_TIMEOUT=>15]);
    $r=json_decode(curl_exec($ch),true);curl_close($ch);
    $state=$r['state']??'';
    if($state==='completed'){
        $url=$r['assets']['video']??null;
        Response::ok(['status'=>'SUCCEEDED','url'=>$url]);
    }
    Response::ok(['status'=>$state==='failed'?'FAILED':'PENDING','error'=>$r['failure_reason']??null]);
});

// ── InVideo AI ─────────────────────────────────────────────────
$router->post('/ai/invideo-video', function() {
    Auth::require();
    $b=body(); $prompt=$b['prompt']??'';
    $apiKey=getenv('INVIDEO_API_KEY')?:DB::one("SELECT value FROM settings WHERE key_name='invideo_api_key'")['value']??'';
    if(!$apiKey) Response::json(['error'=>'InVideo API key not configured. Get it from invideo.ai → API. Add in Settings → API Keys.'],400);
    $ch=curl_init('https://api.invideo.io/v1/videos');
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_POST=>true,CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: Bearer '.$apiKey],CURLOPT_POSTFIELDS=>json_encode(['script'=>$prompt,'voice'=>'en-US-male','resolution'=>'1080p','background_music'=>true]),CURLOPT_TIMEOUT=>30]);
    $r=json_decode(curl_exec($ch),true);curl_close($ch);
    if(isset($r['id'])||isset($r['video_id'])) Response::ok(['task_id'=>$r['id']??$r['video_id'],'provider'=>'invideo','url'=>$r['preview_url']??null]);
    // InVideo may return video directly
    if(isset($r['url'])) Response::ok(['status'=>'SUCCEEDED','url'=>$r['url'],'provider'=>'invideo']);
    Response::json(['error'=>'InVideo: '.($r['message']??json_encode($r))],500);
});


// ═══════════════════════════════════════════════════════════════
// LEAD MAGNET DOUBLE OPT-IN
// ═══════════════════════════════════════════════════════════════

// Get all lead magnet opt-in forms
$router->get('/lead-magnet-optins', function() {
    Auth::require();
    Response::ok(DB::all('SELECT * FROM lead_magnet_optins WHERE active=1 ORDER BY id DESC'));
});

// Create a lead magnet opt-in form
$router->post('/lead-magnet-optins', function() {
    Auth::require(); $b=body();
    $id = DB::insert('lead_magnet_optins', [
        'site_id'         => (int)($b['site_id']??1),
        'name'            => $b['name']??'Lead Magnet',
        'magnet_title'    => $b['magnet_title']??'',
        'magnet_url'      => $b['magnet_url']??'',
        'double_optin'    => (int)($b['double_optin']??1),
        'confirm_subject' => $b['confirm_subject']??'Please confirm your email',
        'confirm_body'    => $b['confirm_body']??'',
        'delivery_subject'=> $b['delivery_subject']??'Here is your free resource!',
        'delivery_body'   => $b['delivery_body']??'',
        'from_email'      => $b['from_email']??'',
        'from_name'       => $b['from_name']??'FlowPost',
        'redirect_url'    => $b['redirect_url']??null,
        'active'          => 1,
    ]);
    Response::ok(DB::one('SELECT * FROM lead_magnet_optins WHERE id=?',[$id]));
});

$router->delete('/lead-magnet-optins/{id}', function(array $p) {
    Auth::require(); DB::update('lead_magnet_optins',['active'=>0],'id=?',[(int)$p['id']]);
    Response::ok(['ok'=>true]);
});

// Public: subscriber submits form (POST from website/landing page)
$router->post('/optin/{form_id}', function(array $p) {
    $form = DB::one('SELECT * FROM lead_magnet_optins WHERE id=? AND active=1', [(int)($p["form_id"]??0)]);
    if (!$form) Response::json(['error'=>'Form not found'], 404);

    $b     = body();
    $email = strtolower(trim($b['email']??''));
    $name  = trim($b['name']??'');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) Response::json(['error'=>'Invalid email'], 400);

    // Check if already subscribed
    $existing = DB::one('SELECT * FROM email_subscribers WHERE email=? AND site_id=?', [$email, $form['site_id']]);



    if ($form['double_optin']) {
        // Double opt-in flow
        $token = bin2hex(random_bytes(32));
        if ($existing) {
            DB::update('email_subscribers', ['confirm_token'=>$token,'double_optin'=>1], 'id=?', [$existing['id']]);
        } else {
            DB::insert('email_subscribers', ['site_id'=>$form['site_id'],'email'=>$email,'name'=>$name,'status'=>'unsubscribed','source'=>'optin_form','double_optin'=>1,'confirm_token'=>$token]);
        }
        // Send confirmation email
        $confirmUrl = rtrim(getenv('FP_APP_URL'),'').'/api/confirm-optin/'.$token;
        $body = $form['confirm_body'] ?: '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
<h2 style="color:#1a1a2e;margin:0 0 12px">Almost there, '.($name?htmlspecialchars($name):'friend').'!</h2>
<p style="color:#555;line-height:1.7;margin:0 0 24px">Confirm your email to receive: <strong>'.htmlspecialchars($form["magnet_title"]).'</strong></p>
<table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="padding:8px 0">
<a href="'.$confirmUrl.'" style="background-color:#5b3cf5;color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-weight:bold;font-size:16px;font-family:Arial,sans-serif;display:inline-block;border:2px solid #5b3cf5">
Confirm &amp; Get My Free Resource
</a></td></tr></table>
<p style="margin:20px 0 0;font-size:11px;color:#aaa;text-align:center">Ignore this email if you did not request it.</p>
</div>';
        EmailService::send($email, $name, $form["confirm_subject"]?:"Confirm your email", $body, "", ["from_email"=>$form["from_email"],"from_name"=>$form["from_name"]]);
        DB::update('lead_magnet_optins',['subscribers_count'=>($form['subscribers_count']+1)],'id=?',[$form['id']]);
        Response::ok(['status'=>'confirm_sent','message'=>'Check your email to confirm and receive your free resource!']);
    } else {
        // Single opt-in — deliver immediately
        if (!$existing) {
            DB::insert('email_subscribers', ['site_id'=>$form['site_id'],'email'=>$email,'name'=>$name,'status'=>'subscribed','source'=>'optin_form','double_optin'=>0,'confirmed_at'=>date('Y-m-d H:i:s')]);
        } else {
            DB::update('email_subscribers', ['status'=>'subscribed','confirmed_at'=>date('Y-m-d H:i:s')], 'id=?', [$existing['id']]);
        }
        // Send delivery email
        $body = $form['delivery_body'] ?: '<p>Hi '.($name?htmlspecialchars($name):'there').',</p><p>Thank you! Here is your free resource:</p><div style="text-align:center;margin:24px 0"><a href="'.htmlspecialchars($form['magnet_url']).'" style="background:#5b3cf5;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700">Download: '.htmlspecialchars($form['magnet_title']).'</a></div>';
        EmailService::send($email, $name, $form["delivery_subject"]?:"Here is your free resource!", $body, "", ["from_email"=>$form["from_email"],"from_name"=>$form["from_name"]]);
        DB::update('lead_magnet_optins',['subscribers_count'=>($form['subscribers_count']+1)],'id=?',[$form['id']]);
        Response::ok(['status'=>'delivered','message'=>'Success! Check your email.','redirect'=>$form['redirect_url']]);
    }
});

// Public: subscriber clicks confirm link
$router->get('/confirm-optin/{token}', function(array $p) {
    $token = $p['token']??'';
    $sub   = DB::one('SELECT * FROM email_subscribers WHERE confirm_token=?', [$token]);
    if (!$sub) { header('Location: /?confirm=invalid'); exit; }

    DB::update('email_subscribers', ['status'=>'subscribed','confirmed_at'=>date('Y-m-d H:i:s'),'confirm_token'=>null], 'id=?', [$sub['id']]);

    // Find the form to get delivery details
    $form = DB::one('SELECT * FROM lead_magnet_optins WHERE site_id=? AND active=1 ORDER BY id DESC LIMIT 1', [$sub['site_id']]);
    if ($form) {
    
        $name = $sub['name']??'';
        $body = $form['delivery_body'] ?: '<p>Hi '.($name?htmlspecialchars($name):'there').',</p><p>Your email is confirmed! Here is your free resource:</p><div style="text-align:center;margin:24px 0"><a href="'.htmlspecialchars($form['magnet_url']).'" style="background:#5b3cf5;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700">Download: '.htmlspecialchars($form['magnet_title']).'</a></div>';
        EmailService::send($sub["email"], $name, $form["delivery_subject"]?:"Here is your free resource!", $body, "", ["from_email"=>$form["from_email"],"from_name"=>$form["from_name"]]);
        if ($form['redirect_url']) { header('Location: '.$form['redirect_url']); exit; }
    }
    $redir = isset($form) && $form ? ($form['redirect_url'] ?: $form['magnet_url'] ?: 'https://sanmidawodu.org') : 'https://sanmidawodu.org';
    header('Location: '.$redir);
    exit;
});


// ═══════════════════════════════════════════════════════════════
// AI VOICE LEARNING
// ═══════════════════════════════════════════════════════════════
$router->get('/voice-profiles', function() {
    Auth::require(); $u=Auth::user();
    Response::ok(DB::all('SELECT * FROM voice_profiles WHERE user_id=? AND active=1 ORDER BY id DESC',[$u['id']]));
});

$router->post('/voice-profiles/train', function() {
    Auth::require(); $u=Auth::user(); $b=body();
    $siteId  = (int)($b['site_id']??1);
    $platform= $b['platform']??'general';
    $name    = $b['name']??'My Voice';
    $samples = $b['sample_posts']??[]; // Array of post texts

    // If no samples provided, pull from existing published posts
    if (empty($samples)) {
        $posts = DB::all('SELECT caption FROM posts WHERE site_id=? AND status="published" AND caption IS NOT NULL ORDER BY id DESC LIMIT 20',[$siteId]);
        $samples = array_column($posts,'caption');
    }
    if (empty($samples)) Response::json(['error'=>'No posts found to learn from. Publish some posts first or provide sample text.'],400);

    $openaiKey = getenv('OPENAI_API_KEY') ?: DB::one("SELECT value FROM settings WHERE key_name='openai_api_key'")['value']??'';
    if (!$openaiKey) Response::json(['error'=>'OpenAI API key required'],400);

    $sampleText = implode("\n\n---\n\n", array_slice($samples,0,15));
    $prompt = "Analyze these social media posts and create a detailed voice/style profile:\n\n$sampleText\n\nProvide a JSON response with:\n- tone_summary: 2-3 sentences describing the overall tone and personality\n- style_notes: bullet points of specific patterns (sentence length, punctuation habits, emoji use, hashtag style, opening/closing patterns, vocabulary level)\n- example_phrases: 5 phrases or sentence starters typical of this voice\n\nReturn ONLY valid JSON.";

    $ch=curl_init('https://api.openai.com/v1/chat/completions');
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_POST=>true,CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: Bearer '.$openaiKey],CURLOPT_POSTFIELDS=>json_encode(['model'=>'gpt-4o-mini','messages'=>[['role'=>'user','content'=>$prompt]],'max_tokens'=>800]),CURLOPT_TIMEOUT=>30]);
    $r=json_decode(curl_exec($ch),true);curl_close($ch);
    $text=trim($r['choices'][0]['message']['content']??'');
    preg_match('/\{[\s\S]*\}/',$text,$m);
    $profile=json_decode($m[0]??'{}',true)??[];

    // Save or update profile
    $ex=DB::one('SELECT id FROM voice_profiles WHERE site_id=? AND platform=? AND user_id=?',[$siteId,$platform,$u['id']]);
    $data=['site_id'=>$siteId,'user_id'=>$u['id'],'name'=>$name,'platform'=>$platform,'tone_summary'=>$profile['tone_summary']??'','style_notes'=>json_encode($profile['style_notes']??[]),'sample_posts'=>json_encode(array_slice($samples,0,5)),'trained_at'=>date('Y-m-d H:i:s'),'active'=>1];
    if($ex) { DB::update('voice_profiles',$data,'id=?',[$ex['id']]); $pid=$ex['id']; }
    else $pid=DB::insert('voice_profiles',$data);

    Response::ok(['id'=>$pid,'profile'=>$profile],'Voice profile trained!');
});

$router->get('/voice-profiles/{id}', function(array $p) {
    Auth::require();
    Response::ok(DB::one('SELECT * FROM voice_profiles WHERE id=?',[(int)$p['id']]));
});

$router->delete('/voice-profiles/{id}', function(array $p) {
    Auth::require(); DB::update('voice_profiles',['active'=>0],'id=?',[(int)$p['id']]); Response::ok(['ok'=>true]);
});

// Generate caption using voice profile
$router->post('/ai/voice-caption', function() {
    Auth::require(); $b=body();
    $profileId=(int)($b['profile_id']??0);
    $topic=$b['topic']??''; $platform=$b['platform']??'general';
    $openaiKey=getenv('OPENAI_API_KEY')?:DB::one("SELECT value FROM settings WHERE key_name='openai_api_key'")['value']??'';
    if(!$openaiKey) Response::json(['error'=>'OpenAI key required'],400);

    $profile = $profileId ? DB::one('SELECT * FROM voice_profiles WHERE id=?',[$profileId]) : null;
    $voiceInstructions = '';
    if($profile){
        $voiceInstructions = "\n\nWRITE IN THIS SPECIFIC VOICE:\nTone: {$profile['tone_summary']}\nStyle: ".json_encode(json_decode($profile['style_notes'],true));
        $samples=json_decode($profile['sample_posts']??'[]',true);
        if($samples) $voiceInstructions.="\n\nExamples of this voice:\n".implode("\n\n",array_slice($samples,0,3));
    }

    $prompt="Write a social media post for $platform about: $topic$voiceInstructions\n\nReturn ONLY the post text, nothing else.";
    $ch=curl_init('https://api.openai.com/v1/chat/completions');
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_POST=>true,CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: Bearer '.$openaiKey],CURLOPT_POSTFIELDS=>json_encode(['model'=>'gpt-4o-mini','messages'=>[['role'=>'user','content'=>$prompt]],'max_tokens'=>400]),CURLOPT_TIMEOUT=>30]);
    $r=json_decode(curl_exec($ch),true);curl_close($ch);
    Response::ok(['caption'=>trim($r['choices'][0]['message']['content']??'')]);
});

// ═══════════════════════════════════════════════════════════════
// RSS → MULTIPLE FORMATS
// ═══════════════════════════════════════════════════════════════
$router->post('/ai/blog-to-social', function() {
    Auth::require(); $b=body();
    $url=$b['url']??''; $title=$b['title']??''; $content=$b['content']??'';
    $platforms=$b['platforms']??['twitter','linkedin','instagram','facebook','telegram'];
    $profileId=(int)($b['profile_id']??0);

    // Fetch content from URL if not provided
    if(!$content && $url){
        $ch=curl_init($url);
        curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>15,CURLOPT_FOLLOWLOCATION=>true,CURLOPT_USERAGENT=>'FlomiPost/1.0']);
        $html=curl_exec($ch);curl_close($ch);
        // Extract text
        $content=strip_tags(preg_replace('/<script[^>]*>.*?<\/script>/si','',$html));
        $content=preg_replace('/\s+/',' ',trim($content));
        $content=substr($content,0,3000);
        if(!$title) preg_match('/<title[^>]*>(.*?)<\/title>/si',$html,$tm) && ($title=strip_tags($tm[1]??''));
    }
    if(!$content&&!$title) Response::json(['error'=>'Provide URL or content'],400);

    $openaiKey=getenv('OPENAI_API_KEY')?:DB::one("SELECT value FROM settings WHERE key_name='openai_api_key'")['value']??'';
    if(!$openaiKey) Response::json(['error'=>'OpenAI key required'],400);

    $voiceCtx='';
    if($profileId){
        $vp=DB::one('SELECT * FROM voice_profiles WHERE id=?',[$profileId]);
        if($vp) $voiceCtx="\n\nWrite in this voice - Tone: {$vp['tone_summary']}";
    }

    $platformFormats=[
        'twitter'=>'Twitter/X: max 280 chars, punchy, 1-2 hashtags',
        'linkedin'=>'LinkedIn: professional, 150-300 chars, insight-focused, 3-5 hashtags',
        'instagram'=>'Instagram: visual, emotional, 150 chars + 5-10 hashtags on new lines',
        'facebook'=>'Facebook: conversational, 2-3 sentences, engaging question, 2-3 hashtags',
        'telegram'=>'Telegram: informative, can be longer, include key points',
        'tiktok'=>'TikTok: trendy, hook in first line, 3-5 hashtags',
        'threads'=>'Threads: casual, conversational, under 500 chars',
    ];

    $requestedFormats=array_intersect_key($platformFormats,array_flip($platforms));
    $formatsText=implode("\n",$requestedFormats);

    $prompt="Turn this blog content into platform-specific social media posts.$voiceCtx\n\nTitle: $title\n\nContent: $content\n\nCreate one post for each:\n$formatsText\n\nReturn a JSON object with platform names as keys and post text as values. Return ONLY valid JSON.";

    $ch=curl_init('https://api.openai.com/v1/chat/completions');
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_POST=>true,CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: Bearer '.$openaiKey],CURLOPT_POSTFIELDS=>json_encode(['model'=>'gpt-4o-mini','messages'=>[['role'=>'user','content'=>$prompt]],'max_tokens'=>2000]),CURLOPT_TIMEOUT=>45]);
    $r=json_decode(curl_exec($ch),true);curl_close($ch);
    $text=trim($r['choices'][0]['message']['content']??'');
    preg_match('/\{[\s\S]*\}/',$text,$m);
    $posts=json_decode($m[0]??'{}',true)??[];
    Response::ok(['posts'=>$posts,'title'=>$title,'source_url'=>$url]);
});

// ═══════════════════════════════════════════════════════════════
// AI CAROUSEL CREATOR
// ═══════════════════════════════════════════════════════════════
$router->post('/ai/generate-carousel', function() {
    Auth::require(); $u=Auth::user(); $b=body();
    $topic=$b['topic']??''; $slides_count=(int)($b['slides']??7);
    $siteId=(int)($b['site_id']??1);
    $brandColor=$b['brand_color']??'#5b3cf5';
    $profileId=(int)($b['profile_id']??0);

    $openaiKey=getenv('OPENAI_API_KEY')?:DB::one("SELECT value FROM settings WHERE key_name='openai_api_key'")['value']??'';
    if(!$openaiKey) Response::json(['error'=>'OpenAI key required'],400);
    if(!$topic) Response::json(['error'=>'Topic required'],400);

    $voiceCtx='';
    if($profileId){ $vp=DB::one('SELECT * FROM voice_profiles WHERE id=?',[$profileId]); if($vp) $voiceCtx=" Write in this voice: {$vp['tone_summary']}"; }

    $prompt="Create a $slides_count-slide carousel post about: $topic$voiceCtx\n\nReturn a JSON array of slide objects. Each slide must have:\n- slide_number: (1 to $slides_count)\n- type: \"cover\", \"content\", or \"cta\"\n- headline: (short, punchy, max 8 words)\n- body: (1-2 sentences max, conversational)\n- emoji: (1 relevant emoji)\n\nSlide 1 = cover (hook), slides 2-".($slides_count-1)." = content, last slide = CTA.\nReturn ONLY valid JSON array.";

    $ch=curl_init('https://api.openai.com/v1/chat/completions');
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_POST=>true,CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: Bearer '.$openaiKey],CURLOPT_POSTFIELDS=>json_encode(['model'=>'gpt-4o-mini','messages'=>[['role'=>'user','content'=>$prompt]],'max_tokens'=>1500]),CURLOPT_TIMEOUT=>30]);
    $r=json_decode(curl_exec($ch),true);curl_close($ch);
    $text=trim($r['choices'][0]['message']['content']??'');
    preg_match('/\[[\s\S]*\]/',$text,$m);
    $slides=json_decode($m[0]??'[]',true)??[];

    // Save carousel
    $pid=DB::insert('carousel_posts',['site_id'=>$siteId,'user_id'=>$u['id'],'title'=>substr($topic,0,100),'slides'=>json_encode($slides),'brand_color'=>$brandColor,'status'=>'ready']);
    Response::ok(['id'=>$pid,'slides'=>$slides,'slide_count'=>count($slides)]);
});

$router->get('/carousels', function() {
    Auth::require(); $u=Auth::user();
    Response::ok(DB::all('SELECT id,title,brand_color,status,created_at FROM carousel_posts WHERE user_id=? ORDER BY id DESC LIMIT 20',[$u['id']]));
});

$router->get('/carousels/{id}', function(array $p) {
    Auth::require();
    Response::ok(DB::one('SELECT * FROM carousel_posts WHERE id=?',[(int)$p['id']]));
});


// ═══════════════════════════════════════════════════════════════
// POST APPROVAL WORKFLOW
// ═══════════════════════════════════════════════════════════════
$router->get('/approvals', function() {
    $u = Auth::require();
    $siteId = (int)(param('site_id', 0));
    $status = param('status', 'pending');
    $where = $siteId ? 'WHERE p.site_id=? AND p.approval_status=?' : 'WHERE p.approval_status=?';
    $params = $siteId ? [$siteId, $status] : [$status];
    $posts = DB::all("SELECT p.id,p.caption,p.approval_status,p.approval_note,p.scheduled_at,p.created_at,u.name as author_name FROM posts p LEFT JOIN users u ON u.id=p.user_id $where ORDER BY p.id DESC LIMIT 100", $params);
    Response::ok($posts);
});

$router->post('/approvals/{id}/request', function(array $p) {
    $u = Auth::require();
    ApprovalGate::requestApproval((int)$p['id'], $u['id']);
    Response::ok(null, 'Approval requested');
});

$router->post('/approvals/{id}/approve', function(array $p) {
    $u = Auth::require();
    $b = body();
    ApprovalGate::approve((int)$p['id'], $u['id'], $b['note'] ?? '');
    (new WebhookDispatcher(DB::all("SELECT * FROM outbound_webhooks WHERE active=1 AND JSON_CONTAINS(events,'\"post.approved\"')")))->dispatch('post.approved', ['post_id' => (int)$p['id'], 'approved_by' => $u['id']]);
    Response::ok(null, 'Post approved');
});

$router->post('/approvals/{id}/reject', function(array $p) {
    $u = Auth::require();
    $b = body();
    required($b, ['note']);
    ApprovalGate::reject((int)$p['id'], $u['id'], $b['note']);
    Response::ok(null, 'Post rejected');
});

// ═══════════════════════════════════════════════════════════════
// POST TEMPLATES
// ═══════════════════════════════════════════════════════════════
$router->get('/templates', function() {
    $u = Auth::require();
    $siteId = (int)(param('site_id', 0));
    $where = $siteId ? 'WHERE site_id=? ORDER BY id DESC' : 'ORDER BY id DESC';
    $params = $siteId ? [$siteId] : [];
    Response::ok(DB::all("SELECT * FROM post_templates $where LIMIT 200", $params));
});

$router->post('/templates', function() {
    $u = Auth::require();
    $b = body();
    required($b, ['site_id', 'name', 'channel', 'content']);
    $id = DB::insert('post_templates', [
        'site_id'    => (int)$b['site_id'],
        'name'       => $b['name'],
        'channel'    => $b['channel'],
        'content'    => $b['content'],
        'media_urls' => isset($b['media_urls']) ? json_encode($b['media_urls']) : null,
        'created_by' => $u['id'],
    ]);
    Response::ok(['id' => $id], 'Template created');
});

$router->put('/templates/{id}', function(array $p) {
    Auth::require();
    $b = body();
    DB::update('post_templates', array_filter([
        'name'       => $b['name'] ?? null,
        'content'    => $b['content'] ?? null,
        'media_urls' => isset($b['media_urls']) ? json_encode($b['media_urls']) : null,
    ], fn($v) => $v !== null), 'id=?', [(int)$p['id']]);
    Response::ok(null, 'Template updated');
});

$router->delete('/templates/{id}', function(array $p) {
    Auth::require();
    DB::run('DELETE FROM post_templates WHERE id=?', [(int)$p['id']]);
    Response::ok(null, 'Template deleted');
});
$router->post('/templates/bulk-delete', function() {
    Auth::require();
    $ids = array_map('intval', (array)(body()['ids'] ?? []));
    if (!$ids) Response::json(['error' => 'No ids provided'], 400);
    $ph = implode(',', array_fill(0, count($ids), '?'));
    DB::run("DELETE FROM post_templates WHERE id IN($ph)", $ids);
    Response::ok(['deleted' => count($ids)], count($ids) . ' templates deleted');
});

$router->post('/templates/{id}/use', function(array $p) {
    $u = Auth::require();
    $tpl = DB::one('SELECT * FROM post_templates WHERE id=?', [(int)$p['id']]);
    if (!$tpl) Response::json(['error' => 'Template not found'], 404);
    $b = body();
    $postId = DB::insert('posts', [
        'site_id'          => (int)($b['site_id'] ?? $tpl['site_id']),
        'user_id'          => $u['id'],
        'caption'          => $tpl['content'],
        'status'           => 'draft',
        'approval_status'  => 'draft',
        'scheduled_at'     => $b['scheduled_at'] ?? null,
    ]);
    Response::ok(['post_id' => $postId], 'Post created from template');
});

// ═══════════════════════════════════════════════════════════════
// OUTBOUND WEBHOOKS
// ═══════════════════════════════════════════════════════════════
$router->get('/webhooks', function() {
    Auth::require();
    Response::ok(DB::all('SELECT id,url,events,active,created_at FROM outbound_webhooks ORDER BY id DESC'));
});

$router->post('/webhooks', function() {
    Auth::require();
    $b = body();
    required($b, ['url', 'events']);
    if (!filter_var($b['url'], FILTER_VALIDATE_URL)) Response::json(['error' => 'Invalid URL'], 400);
    $secret = bin2hex(random_bytes(20));
    $id = DB::insert('outbound_webhooks', [
        'url'    => $b['url'],
        'secret' => $secret,
        'events' => json_encode(array_values((array)$b['events'])),
        'active' => 1,
    ]);
    Response::ok(['id' => $id, 'secret' => $secret], 'Webhook created');
});

$router->put('/webhooks/{id}', function(array $p) {
    Auth::require();
    $b = body();
    DB::update('outbound_webhooks', array_filter([
        'url'    => $b['url'] ?? null,
        'events' => isset($b['events']) ? json_encode(array_values((array)$b['events'])) : null,
        'active' => isset($b['active']) ? (int)$b['active'] : null,
    ], fn($v) => $v !== null), 'id=?', [(int)$p['id']]);
    Response::ok(null, 'Webhook updated');
});

$router->delete('/webhooks/{id}', function(array $p) {
    Auth::require();
    DB::run('DELETE FROM outbound_webhooks WHERE id=?', [(int)$p['id']]);
    Response::ok(null, 'Webhook deleted');
});
$router->post('/webhooks/bulk-delete', function() {
    Auth::require();
    $ids = array_map('intval', (array)(body()['ids'] ?? []));
    if (!$ids) Response::json(['error' => 'No ids provided'], 400);
    $ph = implode(',', array_fill(0, count($ids), '?'));
    DB::run("DELETE FROM outbound_webhooks WHERE id IN($ph)", $ids);
    Response::ok(['deleted' => count($ids)], count($ids) . ' webhooks deleted');
});

$router->get('/webhooks/{id}/deliveries', function(array $p) {
    Auth::require();
    $rows = DB::all('SELECT event,response_code,delivered_at FROM webhook_deliveries WHERE webhook_id=? ORDER BY id DESC LIMIT 50', [(int)$p['id']]);
    Response::ok($rows);
});

$router->post('/webhooks/{id}/test', function(array $p) {
    Auth::require();
    $wh = DB::one('SELECT * FROM outbound_webhooks WHERE id=?', [(int)$p['id']]);
    if (!$wh) Response::json(['error' => 'Not found'], 404);
    $d = new WebhookDispatcher([$wh]);
    $d->dispatch('webhook.test', ['timestamp' => time()]);
    Response::ok(null, 'Test event sent');
});

// ═══════════════════════════════════════════════════════════════
// TOTP / 2FA
// ═══════════════════════════════════════════════════════════════
$router->get('/auth/totp/status', function() {
    $u = Auth::require();
    $row = DB::one('SELECT totp_enabled FROM users WHERE id=?', [$u['id']]);
    Response::ok(['enabled' => (bool)($row['totp_enabled'] ?? false)]);
});

$router->post('/auth/totp/setup', function() {
    $u = Auth::require();
    $totp = new TOTPAuthenticator();
    $secret = $totp->generateSecret();
    DB::update('users', ['totp_secret' => $secret, 'totp_enabled' => 0], 'id=?', [$u['id']]);
    $uri = $totp->getProvisioningUri($secret, $u['email'] ?? $u['name'], 'FlomiPost');
    Response::ok(['secret' => $secret, 'uri' => $uri]);
});

$router->post('/auth/totp/verify', function() {
    $u = Auth::require();
    $b = body();
    required($b, ['code']);
    $row = DB::one('SELECT totp_secret FROM users WHERE id=?', [$u['id']]);
    if (!$row || !$row['totp_secret']) Response::json(['error' => 'Run setup first'], 400);
    $totp = new TOTPAuthenticator();
    if (!$totp->verify($row['totp_secret'], $b['code'])) Response::json(['error' => 'Invalid code'], 400);
    $backupCodes = $totp->generateBackupCodes();
    DB::update('users', ['totp_enabled' => 1, 'totp_backup_codes' => json_encode($backupCodes)], 'id=?', [$u['id']]);
    Response::ok(['backup_codes' => $backupCodes], '2FA enabled');
});

$router->post('/auth/totp/disable', function() {
    $u = Auth::require();
    $b = body();
    required($b, ['code']);
    $row = DB::one('SELECT totp_secret FROM users WHERE id=?', [$u['id']]);
    $totp = new TOTPAuthenticator();
    if (!$totp->verify($row['totp_secret'] ?? '', $b['code'])) Response::json(['error' => 'Invalid code'], 400);
    DB::update('users', ['totp_enabled' => 0, 'totp_secret' => null, 'totp_backup_codes' => null], 'id=?', [$u['id']]);
    Response::ok(null, '2FA disabled');
});

// ═══════════════════════════════════════════════════════════════
// CHANNEL HEALTH
// ═══════════════════════════════════════════════════════════════
$router->get('/health/channels', function() {
    $u = Auth::require();
    $siteId = (int)(param('site_id', 0));
    $tracker = new ChannelHealthTracker();
    Response::ok($tracker->getDashboard($siteId ?: null));
});

// ═══════════════════════════════════════════════════════════════
// BULK CSV IMPORT
// ═══════════════════════════════════════════════════════════════
$router->post('/posts/bulk-import', function() {
    $u = Auth::require();
    $b = body();
    required($b, ['site_id', 'rows']);
    $siteId = (int)$b['site_id'];
    // Write rows to temp CSV
    $tmp = tempnam(sys_get_temp_dir(), 'fp_import_') . '.csv';
    $rows = (array)$b['rows'];
    $fh = fopen($tmp, 'w');
    // Write header if not present
    if ($rows && !isset($rows[0]['caption']) && is_array($rows[0])) {
        // rows already associative — write header from keys
        fputcsv($fh, array_keys($rows[0]));
        foreach ($rows as $row) fputcsv($fh, array_values($row));
    } else {
        // rows is array of arrays; first row is header
        foreach ($rows as $row) fputcsv($fh, (array)$row);
    }
    fclose($fh);
    $importer = new BulkImporter();
    $result = $importer->importCsv($tmp, $siteId, $u['id']);
    unlink($tmp);
    Response::ok($result);
});

// ═══════════════════════════════════════════════════════════════
// CONTACT SEGMENTS
// ═══════════════════════════════════════════════════════════════
$router->get('/segments', function() {
    $u = Auth::require();
    $siteId = (int)(param('site_id', 0));
    $where = $siteId ? 'WHERE site_id=?' : '';
    $params = $siteId ? [$siteId] : [];
    Response::ok(DB::all("SELECT id,name,filters,created_at FROM contact_segments $where ORDER BY id DESC", $params));
});

$router->post('/segments', function() {
    $u = Auth::require();
    $b = body();
    required($b, ['site_id', 'name', 'filters']);
    $sb = new SegmentBuilder();
    $id = $sb->create((int)$b['site_id'], $b['name'], (array)$b['filters']);
    Response::ok(['id' => $id], 'Segment created');
});

$router->get('/segments/{id}/contacts', function(array $p) {
    Auth::require();
    $sb = new SegmentBuilder();
    $contacts = $sb->resolve((int)$p['id']);
    Response::ok($contacts);
});

$router->get('/segments/{id}/count', function(array $p) {
    Auth::require();
    $sb = new SegmentBuilder();
    Response::ok(['count' => $sb->count((int)$p['id'])]);
});

$router->delete('/segments/{id}', function(array $p) {
    Auth::require();
    DB::run('DELETE FROM contact_segments WHERE id=?', [(int)$p['id']]);
    Response::ok(null, 'Segment deleted');
});

// ═══════════════════════════════════════════════════════════════
// AI CAPTION GENERATOR (new endpoint wrapping CaptionGenerator)
// ═══════════════════════════════════════════════════════════════
$router->post('/ai/generate-caption', function() {
    Auth::require();
    $b = body();
    required($b, ['topic']);
    $key = getenv('OPENAI_API_KEY') ?: (DB::one("SELECT value FROM settings WHERE key_name='openai_api_key'")['value'] ?? '');
    if (!$key) Response::json(['error' => 'OpenAI key not configured'], 400);
    $gen = new CaptionGenerator($key);
    $caption = $gen->generate($b['topic'], $b['platform'] ?? 'general', $b['tone'] ?? 'engaging');
    Response::ok(['caption' => $caption]);
});

$router->dispatch();
