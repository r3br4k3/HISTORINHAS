<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, x-admin-password');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

// Configuração do banco de dados
$db_host = 'https://auth-db1193.hstgr.io/index.php?route=/';
$db_user = 'u670150799_williamqb';
$db_pass = 'Williamqb200.';
$db_name = 'u670150799_livro_historia';

// Conectar ao banco
try {
  $conn = new mysqli($db_host, $db_user, $db_pass, $db_name);
  
  if ($conn->connect_error) {
    throw new Exception('Erro ao conectar no banco: ' . $conn->connect_error);
  }
  
  $conn->set_charset('utf8mb4');
} catch (Exception $e) {
  http_response_code(503);
  echo json_encode(['message' => $e->getMessage()]);
  exit;
}

// Constantes
const ADMIN_PASSWORD = 'admin';
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const UPLOAD_DIR = 'uploads/';
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

// Funções auxiliares
function getAdminPassword() {
  $from_header = $_SERVER['HTTP_X_ADMIN_PASSWORD'] ?? '';
  $from_body = $_POST['adminPassword'] ?? $_GET['adminPassword'] ?? '';
  
  return trim($from_header ?: $from_body);
}

function hasAdminAccess() {
  $provided = getAdminPassword();
  return hash_equals(ADMIN_PASSWORD, $provided);
}

function generateUUID() {
  return sprintf(
    '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
    mt_rand(0, 0xffff), mt_rand(0, 0xffff),
    mt_rand(0, 0xffff),
    mt_rand(0, 0x0fff) | 0x4000,
    mt_rand(0, 0x3fff) | 0x8000,
    mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
  );
}

function uploadPhotos($files) {
  global $conn;
  $uploaded = [];
  
  if (!isset($files['name']) || !is_array($files['name'])) {
    return $uploaded;
  }
  
  if (!is_dir(UPLOAD_DIR)) {
    mkdir(UPLOAD_DIR, 0755, true);
  }
  
  for ($i = 0; $i < count($files['name']); $i++) {
    if ($files['error'][$i] !== UPLOAD_ERR_OK) {
      continue;
    }
    
    if ($files['size'][$i] > MAX_FILE_SIZE) {
      continue;
    }
    
    $ext = strtolower(pathinfo($files['name'][$i], PATHINFO_EXTENSION));
    if (!in_array($ext, ALLOWED_EXTENSIONS)) {
      continue;
    }
    
    $base_name = pathinfo($files['name'][$i], PATHINFO_FILENAME);
    $base_name = preg_replace('/[^a-zA-Z0-9-_]/', '-', $base_name);
    $base_name = substr($base_name, 0, 40) ?: 'foto';
    
    $unique = time() . '-' . bin2hex(random_bytes(4));
    $filename = "{$base_name}-{$unique}.{$ext}";
    $filepath = UPLOAD_DIR . $filename;
    
    if (move_uploaded_file($files['tmp_name'][$i], $filepath)) {
      $uploaded[] = '/' . $filepath;
    }
  }
  
  return $uploaded;
}

function deletePhotoFiles($photos) {
  if (!is_array($photos)) {
    return;
  }
  
  foreach ($photos as $photo) {
    if (empty($photo)) continue;
    
    $filepath = str_replace('/', DIRECTORY_SEPARATOR, $photo);
    if (strpos($filepath, '..') === false && file_exists($filepath)) {
      unlink($filepath);
    }
  }
}

function respondError($message, $code = 400) {
  http_response_code($code);
  echo json_encode(['message' => $message]);
  exit;
}

function respondSuccess($data, $code = 200) {
  http_response_code($code);
  echo json_encode($data);
  exit;
}

// Rotas
$request_method = $_SERVER['REQUEST_METHOD'];
$path = $_GET['path'] ?? parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (strpos($path, '/api.php') !== false) {
  $path = str_replace('/api.php', '', $path);
}

// GET /api/stories
if ($request_method === 'GET' && strpos($path, '/stories') === 0) {
  $result = $conn->query('SELECT * FROM stories ORDER BY created_at DESC');
  
  if (!$result) {
    respondError('Erro ao carregar histórias', 500);
  }
  
  $stories = [];
  while ($row = $result->fetch_assoc()) {
    $row['photos'] = json_decode($row['photos'] ?? '[]', true);
    $row['createdAt'] = $row['created_at'];
    $row['updatedAt'] = $row['updated_at'];
    unset($row['created_at'], $row['updated_at']);
    $stories[] = $row;
  }
  
  respondSuccess($stories);
}

// POST /api/admin/verify
if ($request_method === 'POST' && $path === '/admin/verify') {
  if (!hasAdminAccess()) {
    respondError('Segredo admin inválido', 403);
  }
  respondSuccess(['ok' => true]);
}

// POST /api/stories
if ($request_method === 'POST' && $path === '/stories') {
  $title = trim($_POST['title'] ?? '');
  $author = trim($_POST['author'] ?? '');
  $content = trim($_POST['content'] ?? '');
  
  if (empty($title) || empty($content)) {
    respondError('Título e história são obrigatórios', 400);
  }
  
  $uploaded_photos = uploadPhotos($_FILES['photos'] ?? ['name' => []]);
  $id = generateUUID();
  $author = empty($author) ? 'Autor(a) anônimo(a)' : $author;
  $photos_json = json_encode($uploaded_photos);
  
  $stmt = $conn->prepare('INSERT INTO stories (id, title, author, content, photos) VALUES (?, ?, ?, ?, ?)');
  if (!$stmt) {
    respondError('Erro ao preparar query: ' . $conn->error, 500);
  }
  
  $stmt->bind_param('sssss', $id, $title, $author, $content, $photos_json);
  
  if (!$stmt->execute()) {
    respondError('Erro ao salvar história: ' . $stmt->error, 500);
  }
  
  $story = [
    'id' => $id,
    'title' => $title,
    'author' => $author,
    'content' => $content,
    'photos' => $uploaded_photos,
    'createdAt' => date('c')
  ];
  
  respondSuccess($story, 201);
}

// PUT /api/stories/{id}
if ($request_method === 'PUT' && preg_match('#/stories/([a-f0-9-]+)$#', $path, $matches)) {
  if (!hasAdminAccess()) {
    respondError('Segredo admin inválido', 403);
  }
  
  $story_id = $matches[1];
  
  // Ler corpo da requisição
  $input = file_get_contents('php://input');
  if (!empty($_POST)) {
    $title = trim($_POST['title'] ?? '');
    $author = trim($_POST['author'] ?? '');
    $content = trim($_POST['content'] ?? '');
  } else {
    parse_str($input, $data);
    $title = trim($data['title'] ?? '');
    $author = trim($data['author'] ?? '');
    $content = trim($data['content'] ?? '');
  }
  
  if (empty($title) || empty($content)) {
    respondError('Título e história são obrigatórios', 400);
  }
  
  // Buscar história atual
  $stmt = $conn->prepare('SELECT photos FROM stories WHERE id = ?');
  if (!$stmt) {
    respondError('Erro ao preparar query: ' . $conn->error, 500);
  }
  
  $stmt->bind_param('s', $story_id);
  $stmt->execute();
  $result = $stmt->get_result();
  $current = $result->fetch_assoc();
  
  if (!$current) {
    respondError('História não encontrada', 404);
  }
  
  $old_photos = json_decode($current['photos'] ?? '[]', true);
  $uploaded_photos = uploadPhotos($_FILES['photos'] ?? ['name' => []]);
  
  if (!empty($uploaded_photos)) {
    deletePhotoFiles($old_photos);
    $photos_json = json_encode($uploaded_photos);
  } else {
    $photos_json = $current['photos'];
  }
  
  $author = empty($author) ? 'Autor(a) anônimo(a)' : $author;
  
  $update_stmt = $conn->prepare('UPDATE stories SET title = ?, author = ?, content = ?, photos = ? WHERE id = ?');
  if (!$update_stmt) {
    respondError('Erro ao preparar query: ' . $conn->error, 500);
  }
  
  $update_stmt->bind_param('sssss', $title, $author, $content, $photos_json, $story_id);
  
  if (!$update_stmt->execute()) {
    respondError('Erro ao editar história: ' . $update_stmt->error, 500);
  }
  
  $story = [
    'id' => $story_id,
    'title' => $title,
    'author' => $author,
    'content' => $content,
    'photos' => json_decode($photos_json, true),
    'updatedAt' => date('c')
  ];
  
  respondSuccess($story);
}

// DELETE /api/stories/{id}
if ($request_method === 'DELETE' && preg_match('#/stories/([a-f0-9-]+)$#', $path, $matches)) {
  if (!hasAdminAccess()) {
    respondError('Segredo admin inválido', 403);
  }
  
  $story_id = $matches[1];
  
  // Buscar e deletar história
  $stmt = $conn->prepare('SELECT photos FROM stories WHERE id = ?');
  if (!$stmt) {
    respondError('Erro ao preparar query: ' . $conn->error, 500);
  }
  
  $stmt->bind_param('s', $story_id);
  $stmt->execute();
  $result = $stmt->get_result();
  $story = $result->fetch_assoc();
  
  if (!$story) {
    respondError('História não encontrada', 404);
  }
  
  $old_photos = json_decode($story['photos'] ?? '[]', true);
  
  $delete_stmt = $conn->prepare('DELETE FROM stories WHERE id = ?');
  if (!$delete_stmt) {
    respondError('Erro ao preparar query: ' . $conn->error, 500);
  }
  
  $delete_stmt->bind_param('s', $story_id);
  
  if (!$delete_stmt->execute()) {
    respondError('Erro ao excluir história: ' . $delete_stmt->error, 500);
  }
  
  deletePhotoFiles($old_photos);
  
  respondSuccess(['message' => 'História excluída com sucesso']);
}

// Rota não encontrada
http_response_code(404);
echo json_encode(['message' => 'Rota não encontrada']);
