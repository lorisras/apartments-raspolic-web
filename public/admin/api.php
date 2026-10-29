<?php
// Admin API: cijene, zatvaranja, iCal poveznice. Svaki POST traži prijavu i CSRF token.
declare(strict_types=1);
require __DIR__ . '/auth.php';

sigurnosna_zaglavlja();
$korisnik = prijavljen();
if (!$korisnik) json_odgovor(['greska' => 'prijava'], 401);

$op = $_GET['op'] ?? '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    provjeri_csrf();
    $u = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($u)) json_odgovor(['greska' => 'podaci'], 400);
} elseif ($op !== 'stanje') {
    json_odgovor(['greska' => 'metoda'], 405);
}

$broj = fn($v, float $min = 0, float $max = 100000) => is_numeric($v) && (float)$v >= $min && (float)$v <= $max ? round((float)$v, 2) : null;
$mmdd = fn($v) => is_string($v) && preg_match('/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/', $v);
$apOk = fn($o) => in_array($o, oznake(), true);
$gotovo = fn() => json_odgovor(['ok' => true] + stanje());

function stanje(): array {
    return [
        'apartmani' => apartmani(),
        'cijene' => citaj('cijene.json', ['apartmani' => []]),
        'zatvoreno' => citaj('zatvoreno.json'),
        'postavke' => citaj('postavke.json', ['ical' => [], 'kanali' => ['booking' => 0, 'airbnb' => 0]]),
        'ical' => array_map(fn($s) => ['uspjeh' => $s['uspjeh'] ?? null, 'pokusaj' => $s['pokusaj'] ?? null, 'greska' => $s['greska'] ?? '', 'rasponi' => count($s['rasponi'] ?? [])], citaj('ical-stanje.json')),
        'dostupnost' => citaj('dostupnost.json', ['azurirano' => null, 'apartmani' => []]),
        'dvofaktorska' => ['ukljucena' => tfa_ukljucen((string)prijavljen()), 'rezervnih' => tfa_rezervnih((string)prijavljen())],
    ];
}

/** Osjetljive radnje traže vlastitu lozinku (i kod, ako je 2FA uključena). */
function potvrdi_lozinku(string $korisnik, array $u): void {
    if (!ogranicenje("potvrda|$korisnik", 10, 900, false)) json_odgovor(['greska' => 'previse', 'poruka' => 'Previše pokušaja. Pokušajte za 15 minuta.'], 429);
    if (!provjeri_lozinku($korisnik, (string)($u['lozinka'] ?? ''))) {
        ogranicenje("potvrda|$korisnik", 10, 900);
        json_odgovor(['greska' => 'lozinka', 'poruka' => 'Lozinka nije točna.'], 403);
    }
}

switch ($op) {
case 'stanje':
    json_odgovor(stanje() + ['korisnik' => $korisnik]);

// Osnovne cijene svih apartmana odjednom: zajednička razdoblja po godini + za svaki apartman
// osnovnaZa, dodatak, minNoci i godine (cijena, minNoci, sezone = cijene u razdobljima). Ručne cijene po danima ostaju.
case 'osnovno':
    $razdoblja = [];
    foreach ((array)($u['razdoblja'] ?? []) as $g => $lista) {
        if (!preg_match('/^20\d\d$/', (string)$g)) continue;
        foreach ((array)$lista as $r) {
            if (!$mmdd($r['od'] ?? '') || !$mmdd($r['do'] ?? '')) json_odgovor(['greska' => 'razdoblje', 'poruka' => "Razdoblje u $g.: provjerite datume."], 400);
            $razdoblja[(string)$g][] = ['od' => $r['od'], 'do' => $r['do']] + (($m = (int)($r['minNoci'] ?? 0)) > 1 ? ['minNoci' => min($m, 60)] : []);
        }
    }
    $novi = [];
    foreach (oznake() as $o) {
        $x = $u['apartmani'][$o] ?? null;
        if (!is_array($x)) continue;
        $godine = [];
        foreach ((array)($x['godine'] ?? []) as $g => $y) {
            if (!preg_match('/^20\d\d$/', (string)$g)) continue;
            $sezone = [];
            foreach ((array)($y['sezone'] ?? []) as $s) {
                if (!$mmdd($s['od'] ?? '') || !$mmdd($s['do'] ?? '') || $broj($s['cijena'] ?? null, 1) === null) json_odgovor(['greska' => 'sezona', 'poruka' => "$o, $g.: provjerite razdoblja i cijene."], 400);
                $sezone[] = ['od' => $s['od'], 'do' => $s['do'], 'cijena' => $broj($s['cijena'], 1)] + (($m = (int)($s['minNoci'] ?? 0)) > 1 ? ['minNoci' => min($m, 60)] : []);
            }
            $godine[(string)$g] = ['cijena' => $broj($y['cijena'] ?? null, 1), 'sezone' => $sezone] + (($m = (int)($y['minNoci'] ?? 0)) > 1 ? ['minNoci' => min($m, 60)] : []);
        }
        $tip = ($x['dodatak']['tip'] ?? '') === 'postotak' ? 'postotak' : 'iznos';
        $novi[$o] = [
            'osnovnaZa' => max(1, min(20, (int)($x['osnovnaZa'] ?? 1))),
            'dodatak' => ['tip' => $tip, 'vrijednost' => $broj($x['dodatak']['vrijednost'] ?? 0, 0, $tip === 'postotak' ? 200 : 10000) ?? 0],
            'minNoci' => max(1, min(60, (int)($x['minNoci'] ?? 1))),
            'godine' => $godine,
        ];
    }
    uz_bravu(function () use ($novi, $razdoblja) {
        $c = citaj('cijene.json', ['apartmani' => []]);
        foreach ($novi as $o => $cj) $c['apartmani'][$o] = $cj + array_intersect_key($c['apartmani'][$o] ?? [], ['dani' => 1, 'napomena' => 1]);
        $c['razdoblja'] = $razdoblja;
        zapisi('cijene.json', $c);
    });
    $gotovo();

// Cijene po danima za jedan ili više apartmana. 'do' je zadnja noć (uključivo).
// akcija: postavi (vrijednost = cijena), postotak (±%), iznos (±€), obrisi (vrati na osnovnu/sezonsku).
case 'dani':
    $aps = array_values(array_filter((array)($u['apartmani'] ?? []), $apOk));
    $od = $u['od'] ?? ''; $do = $u['do'] ?? '';
    $akcija = $u['akcija'] ?? '';
    if (!$aps || !datum_ok($od) || !datum_ok($do) || $do < $od) json_odgovor(['greska' => 'polja', 'poruka' => 'Odaberite apartmane i datume.'], 400);
    if ((strtotime($do) - strtotime($od)) / 86400 > 400) json_odgovor(['greska' => 'polja', 'poruka' => 'Najviše 400 dana odjednom.'], 400);
    if (!in_array($akcija, ['postavi', 'postotak', 'iznos', 'obrisi'], true)) json_odgovor(['greska' => 'akcija'], 400);
    $v = $akcija === 'obrisi' ? 0 : $broj($u['vrijednost'] ?? null, $akcija === 'postavi' ? 1 : -100000);
    if ($v === null) json_odgovor(['greska' => 'polja', 'poruka' => 'Upišite iznos.'], 400);
    $bez = [];
    uz_bravu(function () use ($aps, $od, $do, $akcija, $v, &$bez) {
        $c = citaj('cijene.json', ['apartmani' => []]);
        foreach ($aps as $o) {
            $cj = $c['apartmani'][$o] ?? [];
            for ($d = $od; $d <= $do; $d = dodaj_dane($d, 1)) {
                if ($akcija === 'obrisi') { unset($cj['dani'][$d]); continue; }
                if ($akcija === 'postavi') { $cj['dani'][$d] = $v; continue; }
                $sad = cijena_dana($cj, $d);
                if ($sad === null) { $bez[$o] = true; continue; }
                $nova = $akcija === 'postotak' ? $sad * (1 + $v / 100) : $sad + $v;
                $cj['dani'][$d] = max(1, round($nova));
            }
            if (!empty($cj['dani'])) ksort($cj['dani']); else unset($cj['dani']);
            $c['apartmani'][$o] = ocisti_cjenik($cj);
        }
        zapisi('cijene.json', $c);
    });
    json_odgovor(['ok' => true, 'bezCijene' => array_keys($bez)] + stanje());

// Ručno zatvaranje samo na webu. 'do' je dan odlaska (prva slobodna noć), kao u kalendarima.
case 'zatvori':
    $aps = array_values(array_filter((array)($u['apartmani'] ?? []), $apOk));
    $od = $u['od'] ?? ''; $do = $u['do'] ?? '';
    if (!$aps || !datum_ok($od) || !datum_ok($do) || $do <= $od) json_odgovor(['greska' => 'polja', 'poruka' => 'Odaberite apartmane, dolazak i odlazak.'], 400);
    uz_bravu(function () use ($aps, $od, $do, $u) {
        $z = citaj('zatvoreno.json');
        $z[] = ['id' => bin2hex(random_bytes(6)), 'apartmani' => $aps, 'od' => $od, 'do' => $do, 'napomena' => mb_substr(trim((string)($u['napomena'] ?? '')), 0, 200)];
        $z = array_values(array_filter($z, fn($x) => $x['do'] >= danas()));
        usort($z, fn($a, $b) => strcmp($a['od'], $b['od']));
        zapisi('zatvoreno.json', $z);
        izracunaj_dostupnost();
    });
    $gotovo();

case 'otvori':
    $id = (string)($u['id'] ?? '');
    uz_bravu(function () use ($id) {
        zapisi('zatvoreno.json', array_values(array_filter(citaj('zatvoreno.json'), fn($x) => $x['id'] !== $id)));
        izracunaj_dostupnost();
    });
    $gotovo();

// iCal poveznice i postotci za kanale (samo pomoć pri ručnom upisu cijena na Booking i Airbnb).
case 'postavke':
    $ical = [];
    foreach (oznake() as $o) foreach (['booking', 'airbnb'] as $k) {
        $url = trim((string)($u['ical'][$o][$k] ?? ''));
        if ($url !== '' && !ical_url_ok($url)) json_odgovor(['greska' => 'url', 'poruka' => "Poveznica za $o ($k) nije https poveznica Bookinga ili Airbnba."], 400);
        if ($url !== '') $ical[$o][$k] = $url;
    }
    $kanali = ['booking' => $broj($u['kanali']['booking'] ?? 0, -50, 100) ?? 0, 'airbnb' => $broj($u['kanali']['airbnb'] ?? 0, -50, 100) ?? 0];
    uz_bravu(fn() => zapisi('postavke.json', ['ical' => $ical, 'kanali' => $kanali]));
    $gotovo();

case 'osvjezi':
    if (!ogranicenje('osvjezi', 6, 600)) json_odgovor(['greska' => 'previse', 'poruka' => 'Pričekajte nekoliko minuta.'], 429);
    $r = uz_bravu(fn() => ical_sinkroniziraj());
    json_odgovor(['ok' => true, 'rezultat' => $r] + stanje());

// ----- dvofaktorska prijava -----
case '2fa-pocni':                       // lozinka → nova tajna (čeka potvrdu kodom)
    potvrdi_lozinku($korisnik, $u);
    if (tfa_ukljucen($korisnik)) json_odgovor(['greska' => 'vec', 'poruka' => 'Dvofaktorska prijava je već uključena.'], 400);
    $_SESSION['nova_tajna'] = tfa_nova_tajna();
    json_odgovor(['ok' => true, 'tajna' => $_SESSION['nova_tajna'], 'uri' => tfa_otpauth($korisnik, $_SESSION['nova_tajna'])]);

case '2fa-ukljuci':                     // kod iz aplikacije potvrđuje da je tajna dobro upisana
    $tajna = $_SESSION['nova_tajna'] ?? '';
    if (!$tajna) json_odgovor(['greska' => 'tajna', 'poruka' => 'Počnite ispočetka.'], 400);
    $korak = totp_provjeri($tajna, preg_replace('/\s/', '', (string)($u['kod'] ?? '')), 0);
    if ($korak === null) json_odgovor(['greska' => 'kod', 'poruka' => 'Kod nije točan. Provjerite da je sat na mobitelu točan i upišite novi kod.'], 400);
    $kodovi = tfa_rezervni_kodovi();
    $ver = bin2hex(random_bytes(8));
    tfa_spremi($korisnik, ['tajna' => $tajna, 'zadnji' => $korak, 'rezerva' => array_map(fn($k) => password_hash(str_replace('-', '', $k), PASSWORD_DEFAULT), $kodovi), 'ver' => $ver]);
    unset($_SESSION['nova_tajna']);
    $_SESSION['ver'] = $ver;            // ova sesija ostaje, sve druge se odjavljuju
    json_odgovor(['ok' => true, 'kodovi' => $kodovi] + stanje());

case '2fa-iskljuci':
    potvrdi_lozinku($korisnik, $u);
    if (!tfa_provjeri($korisnik, (string)($u['kod'] ?? ''))) json_odgovor(['greska' => 'kod', 'poruka' => 'Kod nije točan.'], 400);
    tfa_spremi($korisnik, null);
    $_SESSION['ver'] = '';
    json_odgovor(['ok' => true] + stanje());

case '2fa-kodovi':                      // novi rezervni kodovi (stari prestaju vrijediti)
    potvrdi_lozinku($korisnik, $u);
    if (!tfa_provjeri($korisnik, (string)($u['kod'] ?? ''))) json_odgovor(['greska' => 'kod', 'poruka' => 'Kod nije točan.'], 400);
    $kodovi = tfa_rezervni_kodovi();
    $t = tfa_svi()[$korisnik];
    $t['rezerva'] = array_map(fn($k) => password_hash(str_replace('-', '', $k), PASSWORD_DEFAULT), $kodovi);
    tfa_spremi($korisnik, $t);
    json_odgovor(['ok' => true, 'kodovi' => $kodovi] + stanje());

case 'odjava':
    odjava();
    json_odgovor(['ok' => true]);

default:
    json_odgovor(['greska' => 'op'], 400);
}
