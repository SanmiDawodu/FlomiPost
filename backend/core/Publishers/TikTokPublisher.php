<?php
class TikTokPublisher extends AbstractPublisher {
    public function publish(?array $conn, array $target, array $post, array $media): array {
        if (!$conn) throw new RuntimeException('TikTok: no connected account');
        $token = Crypto::dec($conn['access_token']);
        $text  = strip_tags($post['caption'] ?? '');
        
        // TikTok requires video content
        if (empty($media)) {
            throw new RuntimeException('TikTok: requires a video. Upload a video in Media first.');
        }
        
        $videoUrl = $media[0]['url'] ?? '';
        $videoData = @file_get_contents($videoUrl);
        if (!$videoData) throw new RuntimeException('TikTok: could not fetch video');
        
        // Step 1: Initialize upload
        $init = curl_init('https://open.tiktokapis.com/v2/post/publish/video/init/');
        curl_setopt_array($init, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode([
                'post_info' => ['title'=>mb_substr($text,0,150),'privacy_level'=>'PUBLIC_TO_EVERYONE','disable_comment'=>false],
                'source_info' => ['source'=>'FILE_UPLOAD','video_size'=>strlen($videoData),'chunk_size'=>strlen($videoData),'total_chunk_count'=>1],
            ]),
            CURLOPT_HTTPHEADER => ["Authorization: Bearer $token",'Content-Type: application/json; charset=UTF-8'],
            CURLOPT_TIMEOUT => 30,
        ]);
        $r = json_decode(curl_exec($init), true); curl_close($init);
        
        $uploadUrl = $r['data']['upload_url'] ?? null;
        $publishId = $r['data']['publish_id'] ?? null;
        if (!$uploadUrl) throw new RuntimeException('TikTok init failed: ' . json_encode($r));
        
        // Step 2: Upload video
        $up = curl_init($uploadUrl);
        curl_setopt_array($up, [
            CURLOPT_RETURNTRANSFER=>true,CURLOPT_CUSTOMREQUEST=>'PUT',
            CURLOPT_POSTFIELDS=>$videoData,
            CURLOPT_HTTPHEADER=>['Content-Type: video/mp4','Content-Range: bytes 0-'.(strlen($videoData)-1).'/'.strlen($videoData)],
            CURLOPT_TIMEOUT=>120,
        ]);
        curl_exec($up); curl_close($up);
        
        return ['id' => $publishId, 'url' => null];
    }
}
