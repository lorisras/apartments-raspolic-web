<?php
// Dohvaća kalendare s Bookinga i Airbnba i osvježava zauzetost na webu.
// Pokreće se cronom (cPanel → Cron Jobs), npr. svakih 30 minuta:
//   */30 * * * * /usr/local/bin/php /home/KORISNIK/public_html/api/ical-sync.php >/dev/null 2>&1
// Preko weba je zabranjen (.htaccess i provjera ispod). Ručno osvježavanje: admin → Kalendari → „Osvježi sada“.
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/lib.php';

$tiho = in_array('--tiho', $argv, true);
$r = ical_sinkroniziraj($tiho ? null : fn($t) => print($t . "\n"));
if (!$tiho) echo "Uspješno: {$r['ok']}, greške: " . count($r['greske']) . "\n";
exit($r['greske'] ? 1 : 0);
