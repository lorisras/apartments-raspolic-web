<?php
// Apartments Rašpolić – zajednička jezgra (podaci, sigurnost, iCal). Ne poziva se izravno (.htaccess).
declare(strict_types=1);

date_default_timezone_set('Europe/Zagreb');
mb_internal_encoding('UTF-8');

/** config.php se traži u mapi web-podaci do 3 razine iznad mape weba (izvan javne mape). */
function konfig(): array {
    static $c = null;
    if ($c !== null) return $c;
    $dir = dirname(__DIR__);
    for ($i = 0; $i < 4; $i++) {
        $f = $dir . '/web-podaci/config.php';
        if (is_file($f)) { $c = require $f; break; }
        $dir = dirname($dir);
    }
    if (!is_array($c)) {
        http_response_code(500);
        header('Content-Type: text/plain; charset=utf-8');
        exit("Nedostaje web-podaci/config.php (vidi README).\n");
    }
    $c['podaci'] = rtrim($c['podaci'] ?? '', '/');
    if (!is_dir($c['podaci'])) @mkdir($c['podaci'], 0750, true);
    return $c;
}

function put(string $ime): string { return konfig()['podaci'] . '/' . $ime; }

function citaj(string $ime, $zadano = []) {
    $f = put($ime);
    if (!is_file($f)) return $zadano;
    $d = json_decode((string)file_get_contents($f), true);
    return is_array($d) ? $d : $zadano;
}

/** Atomski zapis (privremena datoteka + rename) uz zaključavanje. */
function zapisi(string $ime, $podaci): void {
    $f = put($ime);
    $tmp = $f . '.' . bin2hex(random_bytes(4)) . '.tmp';
    $json = json_encode($podaci, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($json === false || file_put_contents($tmp, $json, LOCK_EX) === false) throw new RuntimeException('zapis nije uspio: ' . $ime);
    @chmod($tmp, 0640);
    rename($tmp, $f);
}

/** Za promjene koje čitaju pa pišu: jedna brava za sve podatke. */
function uz_bravu(callable $fn) {
    $h = fopen(put('.brava'), 'c');
    flock($h, LOCK_EX);
    try { return $fn(); } finally { flock($h, LOCK_UN); fclose($h); }
}

/** Popis apartmana (generira ga build weba: /api/apartmani.json). */
function apartmani(): array {
    static $a = null;
    if ($a !== null) return $a;
    $d = json_decode((string)@file_get_contents(__DIR__ . '/apartmani.json'), true);
    $a = is_array($d['apartmani'] ?? null) ? $d['apartmani'] : [];
    return $a;
}
function oznake(): array { return array_column(apartmani(), 'oznaka'); }

function json_odgovor($podaci, int $kod = 200): never {
    http_response_code($kod);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($podaci, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function klijent_ip(): string { return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'; }

/** Jednostavno ograničenje broja pokušaja: najviše $max u $sekundi po ključu. Vraća true ako je dopušteno. */
function ogranicenje(string $kljuc, int $max, int $sekundi, bool $zabiljezi = true): bool {
    $mapa = put('ogranicenja');
    if (!is_dir($mapa)) @mkdir($mapa, 0750, true);
    $f = $mapa . '/' . hash('sha256', $kljuc) . '.json';
    $sada = time();
    $t = is_file($f) ? (json_decode((string)file_get_contents($f), true) ?: []) : [];
    $t = array_values(array_filter($t, fn($x) => $x > $sada - $sekundi));
    $ok = count($t) < $max;
    if ($zabiljezi) { $t[] = $sada; file_put_contents($f, json_encode($t), LOCK_EX); }
    return $ok;
}
function ogranicenje_ponisti(string $kljuc): void { @unlink(put('ogranicenja') . '/' . hash('sha256', $kljuc) . '.json'); }

function datum_ok($d): bool {
    return is_string($d) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) && checkdate((int)substr($d, 5, 2), (int)substr($d, 8, 2), (int)substr($d, 0, 4));
}
function dodaj_dane(string $d, int $n): string { return (new DateTimeImmutable($d . ' 12:00'))->modify(($n >= 0 ? '+' : '') . $n . ' day')->format('Y-m-d'); }
function danas(): string { return date('Y-m-d'); }

// ---------------------------------------------------------------------------
// Cijene (ista pravila kao public/js/cijene.js)
// ---------------------------------------------------------------------------

function u_sezoni(string $md, array $s): bool {
    return $s['od'] <= $s['do'] ? ($md >= $s['od'] && $md <= $s['do']) : ($md >= $s['od'] || $md <= $s['do']);
}

function cijena_dana(array $cj, string $datum): ?float {
    if (isset($cj['dani'][$datum]) && $cj['dani'][$datum] !== '') return (float)$cj['dani'][$datum];
    $g = $cj['godine'][substr($datum, 0, 4)] ?? null;
    if (!$g) return null;
    foreach ($g['sezone'] ?? [] as $s) {
        if (u_sezoni(substr($datum, 5), $s) && ($s['cijena'] ?? '') !== '') return (float)$s['cijena'];
    }
    return isset($g['cijena']) && $g['cijena'] !== '' ? (float)$g['cijena'] : null;
}

/** Cjenik bez prošlih ručnih cijena (manje podataka za web). */
function ocisti_cjenik(array $cj): array {
    $od = dodaj_dane(danas(), -1);
    if (!empty($cj['dani'])) $cj['dani'] = array_filter($cj['dani'], fn($k) => $k >= $od, ARRAY_FILTER_USE_KEY);
    return $cj;
}

// ---------------------------------------------------------------------------
// Dostupnost: iCal s Bookinga i Airbnba + ručna zatvaranja
// ---------------------------------------------------------------------------

/** Dopušteni izvori kalendara (samo HTTPS adrese Bookinga i Airbnba). */
function ical_url_ok(string $url): bool {
    $p = parse_url($url);
    if (($p['scheme'] ?? '') !== 'https' || empty($p['host'])) return false;
    $h = strtolower($p['host']);
    return (bool)preg_match('/(^|\.)booking\.com$|(^|\.)airbnb\.(com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})$/', $h);
}

function ical_dohvati(string $url): string {
    if (!ical_url_ok($url)) throw new RuntimeException('poveznica nije Booking/Airbnb (https)');
    $ch = curl_init($url);
    $tijelo = '';
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => false,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_USERAGENT => 'ApartmentsRaspolic-ical/1.0',
        CURLOPT_WRITEFUNCTION => function ($ch, $dio) use (&$tijelo) {
            $tijelo .= $dio;
            return strlen($tijelo) > 2_000_000 ? 0 : strlen($dio);
        },
    ]);
    $ok = curl_exec($ch);
    $kod = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $greska = curl_error($ch);
    curl_close($ch);
    if (!$ok || $kod !== 200) throw new RuntimeException($greska ?: "HTTP $kod");
    if (!str_contains($tijelo, 'BEGIN:VCALENDAR')) throw new RuntimeException('odgovor nije iCal kalendar');
    return $tijelo;
}

/** Iz iCal teksta čita samo datume (DTSTART, DTEND). Sve ostalo (imena, poveznice, telefoni) se odbacuje. */
function ical_rasponi(string $tekst): array {
    $tekst = preg_replace("/\r?\n[ \t]/", '', $tekst);
    $out = []; $ev = null;
    foreach (preg_split("/\r?\n/", $tekst) as $red) {
        if ($red === 'BEGIN:VEVENT') { $ev = []; continue; }
        if ($red === 'END:VEVENT') {
            if (!empty($ev['od'])) {
                $do = $ev['do'] ?? dodaj_dane($ev['od'], 1);
                if ($do > $ev['od']) $out[] = [$ev['od'], $do];
            }
            $ev = null; continue;
        }
        if ($ev === null) continue;
        if (preg_match('/^(DTSTART|DTEND)[^:]*:(\d{4})(\d{2})(\d{2})/', $red, $m)) {
            $ev[$m[1] === 'DTSTART' ? 'od' : 'do'] = "$m[2]-$m[3]-$m[4]";
        }
    }
    return $out;
}

/** Spaja preklapajuće i susjedne raspone, odbacuje prošle i predaleke. */
function spoji_raspone(array $r): array {
    $od = dodaj_dane(danas(), -1); $doGranica = dodaj_dane(danas(), 550);
    $r = array_values(array_filter($r, fn($x) => $x[1] > $od && $x[0] < $doGranica));
    usort($r, fn($a, $b) => strcmp($a[0], $b[0]));
    $out = [];
    foreach ($r as [$a, $b]) {
        $n = count($out);
        if ($n && $a <= $out[$n - 1][1]) { if ($b > $out[$n - 1][1]) $out[$n - 1][1] = $b; }
        else $out[] = [$a, $b];
    }
    return $out;
}

/**
 * Dohvaća sve kalendare i zapisuje dostupnost.json.
 * Ako neki kalendar ne uspije, koristi se zadnji uspješno dohvaćen (ical-stanje.json).
 */
function ical_sinkroniziraj(?callable $dnevnik = null): array {
    $postavke = citaj('postavke.json');
    $stanje = citaj('ical-stanje.json');
    $sada = time();
    $rezultat = ['ok' => 0, 'greske' => []];
    foreach (oznake() as $ozn) {
        foreach (['booking', 'airbnb'] as $kanal) {
            $kljuc = "$ozn|$kanal";
            $url = trim($postavke['ical'][$ozn][$kanal] ?? '');
            if ($url === '') { unset($stanje[$kljuc]); continue; }
            $s = $stanje[$kljuc] ?? ['rasponi' => []];
            $s['pokusaj'] = $sada;
            if (($s['url'] ?? '') !== $url) $s['rasponi'] = [];   // nova poveznica: stari podaci ne vrijede
            $s['url'] = $url;
            try {
                $s['rasponi'] = spoji_raspone(ical_rasponi(ical_dohvati($url)));
                $s['uspjeh'] = $sada; $s['greska'] = '';
                $rezultat['ok']++;
            } catch (Throwable $e) {
                $s['greska'] = $e->getMessage();
                $rezultat['greske'][] = "$ozn $kanal: " . $e->getMessage();
            }
            $stanje[$kljuc] = $s;
            if ($dnevnik) $dnevnik("$kljuc: " . ($s['greska'] ?: count($s['rasponi']) . ' raspona'));
        }
    }
    zapisi('ical-stanje.json', $stanje);
    izracunaj_dostupnost($stanje);
    ical_upozorenje($stanje);
    return $rezultat;
}

/** dostupnost.json = iCal (zadnje uspješno) + ručna zatvaranja. Poziva se i nakon promjene zatvaranja u adminu. */
function izracunaj_dostupnost(?array $stanje = null): void {
    $stanje ??= citaj('ical-stanje.json');
    $zatvoreno = citaj('zatvoreno.json');
    $out = [];
    foreach (oznake() as $ozn) {
        $r = [];
        foreach (['booking', 'airbnb'] as $k) foreach ($stanje["$ozn|$k"]['rasponi'] ?? [] as $x) $r[] = $x;
        foreach ($zatvoreno as $z) if (in_array($ozn, $z['apartmani'] ?? [], true)) $r[] = [$z['od'], $z['do']];
        $out[$ozn] = spoji_raspone($r);
    }
    zapisi('dostupnost.json', ['azurirano' => date('c'), 'apartmani' => $out]);
}

/** E-mail vlasniku ako neki kalendar ne radi 24 h (najviše jednom dnevno). */
function ical_upozorenje(array $stanje): void {
    $c = konfig();
    if (empty($c['email_upozorenja'])) return;
    $lose = [];
    foreach ($stanje as $k => $s) {
        if (!empty($s['greska']) && ($s['uspjeh'] ?? 0) < time() - 86400) $lose[] = "$k: {$s['greska']}";
    }
    $zadnje = citaj('upozorenje.json', ['dan' => '']);
    if (!$lose || $zadnje['dan'] === danas()) return;
    posalji_mail($c['email_upozorenja'], 'Web: kalendar se ne može dohvatiti',
        "Ovi kalendari se ne mogu dohvatiti više od 24 sata, pa web koristi zadnje poznate podatke:\n\n" . implode("\n", $lose) .
        "\n\nProvjerite iCal poveznice u adminu (Kalendari).");
    zapisi('upozorenje.json', ['dan' => danas()]);
}

// ---------------------------------------------------------------------------
// E-mail
// ---------------------------------------------------------------------------

function posalji_mail(string $prima, string $naslov, string $tekst, ?string $odgovorNa = null): bool {
    $c = konfig();
    $od = $c['email_od'] ?? ('web@' . ($_SERVER['HTTP_HOST'] ?? 'localhost'));
    $zaglavlja = [
        'From' => mb_encode_mimeheader($c['naziv'] ?? 'Apartments Rašpolić', 'UTF-8', 'Q') . " <$od>",
        'MIME-Version' => '1.0',
        'Content-Type' => 'text/plain; charset=UTF-8',
        'Content-Transfer-Encoding' => '8bit',
    ];
    if ($odgovorNa) $zaglavlja['Reply-To'] = $odgovorNa;
    if (!empty($c['mail_testni_izlaz'])) {          // za lokalno testiranje: zapis u datoteku umjesto slanja
        file_put_contents($c['mail_testni_izlaz'], "To: $prima\nSubject: $naslov\n" . print_r($zaglavlja, true) . "\n$tekst\n-----\n", FILE_APPEND);
        return true;
    }
    return mail($prima, mb_encode_mimeheader($naslov, 'UTF-8', 'Q'), $tekst, $zaglavlja, '-f' . $od);
}
