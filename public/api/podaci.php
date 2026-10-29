<?php
// Javni podaci za web: zauzetost i cjenik po apartmanu. Bez imena gostiju i drugih osobnih podataka.
declare(strict_types=1);
require __DIR__ . '/lib.php';

$dost = citaj('dostupnost.json', ['azurirano' => null, 'apartmani' => []]);
$cijene = citaj('cijene.json', ['apartmani' => []]);
$out = ['azurirano' => $dost['azurirano'], 'apartmani' => []];
foreach (oznake() as $ozn) {
    $cj = ocisti_cjenik($cijene['apartmani'][$ozn] ?? []);
    unset($cj['napomena']);                       // interne napomene ne idu na web
    $out['apartmani'][$ozn] = ['zauzeto' => $dost['apartmani'][$ozn] ?? [], 'cjenik' => $cj ?: new stdClass()];
}

$json = json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
$etag = '"' . substr(hash('sha256', $json), 0, 20) . '"';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=120');
header('ETag: ' . $etag);
header('X-Content-Type-Options: nosniff');
if (($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) { http_response_code(304); exit; }
echo $json;
