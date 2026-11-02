<?php
/**
 * Exporta os dados do sistema ANTIGO (PHP/MySQL no WAMP) para o novo sistema web.
 *
 * Como usar:
 *  1. Copie este arquivo para C:\wamp64\www\italo_alves_ti\ (pasta do sistema antigo).
 *  2. Abra http://localhost/italo_alves_ti/exportar_para_firebase.php
 *  3. Vai baixar um arquivo .json. No sistema novo: Configurações > Importar do sistema antigo.
 *  4. Depois, APAGUE este arquivo da pasta do WAMP.
 *
 * Funciona com a versão original e com a versão 2.0 do banco. Só lê, não altera nada.
 */

// Ajuste se o seu MySQL tiver outra senha/banco
$host = 'localhost';
$usuario = 'root';
$senha = '';
$banco = 'italo_ti';

if (!in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true)) {
    http_response_code(403);
    exit('Só pode ser executado no próprio computador.');
}

try {
    $pdo = new PDO("mysql:host=$host;dbname=$banco;charset=utf8mb4", $usuario, $senha, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    exit('Não conectou no banco: ' . htmlspecialchars($e->getMessage()));
}

$tabelas = ['clientes', 'itens', 'equipamentos', 'orcamentos', 'orcamento_itens', 'pagamentos'];
$saida = ['origem' => 'mysql', 'exportadoEm' => date('c'), 'banco' => $banco];
$existentes = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
foreach ($tabelas as $t) {
    $saida[$t] = in_array($t, $existentes, true) ? $pdo->query("SELECT * FROM `$t` ORDER BY id")->fetchAll() : [];
}

header('Content-Type: application/json; charset=utf-8');
header('Content-Disposition: attachment; filename="italo_ti_export_' . date('Y-m-d') . '.json"');
echo json_encode($saida, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
