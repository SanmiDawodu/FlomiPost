<?php
require_once __DIR__ . '/load_env.php';
header('Content-Type: application/json');

$expectedSecret = getenv('MSD_PROVISION_SECRET') ?: getenv('FP_PROVISION_SECRET') ?: '';
$providedSecret = $_SERVER['HTTP_X_PROVISION_SECRET'] ?? '';
if (!$expectedSecret || !hash_equals($expectedSecret, $providedSecret)) {
    http_response_code(403);
    echo json_encode(["error"=>"Forbidden"]);
    exit;
}

$domain = trim($_GET["domain"] ?? "");
$email  = trim($_GET["email"] ?? "");
$name   = trim($_GET["name"] ?? "Customer");

if (!$domain || !$email) {
    http_response_code(400);
    echo json_encode(["error"=>"domain and email required"]);
    exit;
}

$log = "/tmp/msd_provision.log";
$cmd = "nohup /usr/local/bin/provision_wp.sh "
    . escapeshellarg($domain) . " "
    . escapeshellarg($email) . " "
    . escapeshellarg($name)
    . " >> $log 2>&1 &";

exec($cmd, $out, $ret);
file_put_contents($log, date("c")." TRIGGERED: $domain for $email\n", FILE_APPEND);

// Save to DB
$dbHost = getenv('MSD_DB_HOST') ?: 'localhost';
$dbName = getenv('MSD_DB_NAME') ?: 'msdhost_customers';
$dbUser = getenv('MSD_DB_USER') ?: '';
$dbPass = getenv('MSD_DB_PASS') ?: '';
$db = new mysqli($dbHost, $dbUser, $dbPass, $dbName);
if (!$db->connect_error) {
    $plan = "starter";
    $status = "pending";
    $stmt = $db->prepare("INSERT INTO customers (domain,email,name,plan,status) VALUES (?,?,?,?,?)");
    $stmt->bind_param("sssss",$domain,$email,$name,$plan,$status);
    $stmt->execute();
}

echo json_encode(["success"=>true,"message"=>"Provisioning started","domain"=>$domain]);
