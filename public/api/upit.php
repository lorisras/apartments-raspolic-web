<?php
// Obrazac za upit: šalje e-mail vlasniku (Reply-To = gost) i kratku potvrdu gostu na njegovom jeziku.
// Upiti se ne spremaju na poslužitelju.
declare(strict_types=1);
require __DIR__ . '/lib.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') json_odgovor(['greska' => 'metoda'], 405);

$u = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($u)) $u = $_POST;
$s = fn($k, $max = 200) => mb_substr(trim(str_replace(["\r", "\0"], '', (string)($u[$k] ?? ''))), 0, $max);
$n = fn($k) => max(0, min(20, (int)($u[$k] ?? 0)));

$jezik = in_array($u['jezik'] ?? '', ['hr', 'en', 'de', 'it'], true) ? $u['jezik'] : 'en';

// Zaštita od spama: skriveno polje mora biti prazno, obrazac ispunjen za više od 3 s, najviše 5 upita na sat s iste adrese.
if ($s('web') !== '') json_odgovor(['ok' => true]);                 // robot: tiho „uspjeh“
if ((int)($u['trajanje'] ?? 0) < 3000) json_odgovor(['greska' => 'prebrzo'], 400);
if (!ogranicenje('upit|' . klijent_ip(), 5, 3600)) json_odgovor(['greska' => 'previse'], 429);

$ime = $s('ime', 100); $email = $s('email', 160); $tel = $s('telefon', 40); $poruka = $s('poruka', 3000);
$od = $s('od', 10); $do = $s('do', 10);
// jedan ili više apartmana (polje 'apartmani'; stari obrazac šalje 'apartman'); prazno = bilo koji slobodan
$trazeni = $u['apartmani'] ?? (($u['apartman'] ?? '') !== '' ? [$u['apartman']] : []);
$trazeni = array_values(array_unique(array_filter(array_slice((array)$trazeni, 0, 20), 'is_string')));
$odrasli = $n('odrasli'); $djeca = $n('djeca'); $bebe = $n('bebe'); $krevetic = !empty($u['krevetic']);

$greske = [];
if (mb_strlen($ime) < 2) $greske[] = 'ime';
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $greske[] = 'email';
if (!datum_ok($od) || !datum_ok($do) || $do <= $od || $od < dodaj_dane(danas(), -1)) $greske[] = 'datumi';
if ($odrasli < 1) $greske[] = 'odrasli';
$sviAp = apartmani();
$aps = array_values(array_filter($sviAp, fn($a) => in_array($a['oznaka'], $trazeni, true)));
if (count($aps) !== count($trazeni)) $greske[] = 'apartman';
$mjesta = array_sum(array_map(fn($a) => (int)($a['maxOsoba'] ?? 99), $aps));
if ($aps && $odrasli + $djeca > $mjesta) $greske[] = 'kapacitet';   // bebe se ne broje
if ($greske) json_odgovor(['greska' => 'polja', 'polja' => $greske], 400);

// Provjera je li termin u međuvremenu zauzet (samo napomena u e-mailu).
$dost = citaj('dostupnost.json', ['apartmani' => []]);
$zauzet = function (string $o) use ($dost, $od, $do): bool {
    foreach ($dost['apartmani'][$o] ?? [] as [$a, $b]) if ($od < $b && $a < $do) return true;
    return false;
};
$noci = (int)round((strtotime($do . ' 12:00') - strtotime($od . ' 12:00')) / 86400);
$fd = fn($d) => (new DateTimeImmutable($d))->format('d.m.Y.');
$JEZIK = ['hr' => 'hrvatski', 'en' => 'engleski', 'de' => 'njemački', 'it' => 'talijanski'][$jezik];

$cijelaKuca = count($aps) === count($sviAp);
if ($aps) {
    $smjestaj = ($cijelaKuca ? "CIJELA KUĆA\n           " : '') . implode("\n           ", array_map(
        fn($a) => $a['naziv'] . ' (do ' . $a['maxOsoba'] . ')' . ($zauzet($a['oznaka']) ? '  ⚠ PREMA KALENDARU ZAUZETO' : ''), $aps))
        . (count($aps) > 1 ? "\n           ukupno mjesta: $mjesta" : '');
} else {
    $slobodni = array_map(fn($a) => $a['naziv'], array_filter($sviAp, fn($a) => !$zauzet($a['oznaka'])));
    $smjestaj = 'bilo koji slobodan (prema kalendaru slobodni: ' . ($slobodni ? implode(', ', $slobodni) : 'nijedan') . ')';
}
$kratko = $cijelaKuca ? 'cijela kuća' : ($aps ? implode(' + ', array_map(fn($a) => preg_replace('/^Apartment /', '', $a['naziv']), $aps)) : 'bilo koji apartman');
$iznos = $s('iznos', 40);

$tekst = "Novi upit s weba\n\n"
    . "Smještaj:  $smjestaj\n"
    . "Termin:    {$fd($od)} – {$fd($do)} ($noci " . ($noci === 1 ? 'noć' : 'noći') . ")\n"
    . "Gosti:     odrasli $odrasli" . ($djeca ? ", djeca (2+) $djeca" : '') . ($bebe ? ", bebe (do 2) $bebe" : '') . "\n"
    . ($krevetic ? "Krevetić:  DA, treba dječji krevetić\n" : '')
    . ($iznos !== '' ? "Iznos:     okvirno $iznos € (izračun na webu)\n" : '')
    . "\nIme:       $ime\nE-mail:    $email\n" . ($tel !== '' ? "Telefon:   $tel\n" : '')
    . "Jezik:     $JEZIK\n"
    . ($poruka !== '' ? "\nPoruka:\n$poruka\n" : '')
    . "\n—\nOdgovorite izravno na ovaj e-mail (ide gostu).";

$c = konfig();
$naslov = "Upit: $kratko, " . ($odrasli + $djeca) . " os., {$fd($od)} – {$fd($do)}, $ime";
if (!posalji_mail($c['email_upiti'], $naslov, $tekst, $email)) json_odgovor(['greska' => 'mail'], 500);

// Potvrda gostu
$P = [
    'hr' => ['Primili smo vaš upit', "Poštovani/a %s,\n\nhvala na upitu za %s (%s – %s). Javit ćemo vam se osobno, obično istog dana.\n\nOvo je automatska potvrda; upit još nije rezervacija.\n\nLijep pozdrav,\nApartments Rašpolić"],
    'en' => ['We have received your inquiry', "Dear %s,\n\nthank you for your inquiry for %s (%s – %s). We will reply personally, usually the same day.\n\nThis is an automatic confirmation; the inquiry is not yet a booking.\n\nKind regards,\nApartments Rašpolić"],
    'de' => ['Wir haben Ihre Anfrage erhalten', "Guten Tag %s,\n\nvielen Dank für Ihre Anfrage für %s (%s – %s). Wir melden uns persönlich, meist noch am selben Tag.\n\nDies ist eine automatische Bestätigung; die Anfrage ist noch keine Buchung.\n\nMit freundlichen Grüßen\nApartments Rašpolić"],
    'it' => ['Abbiamo ricevuto la vostra richiesta', "Gentile %s,\n\ngrazie per la richiesta per %s (%s – %s). Vi risponderemo personalmente, di solito in giornata.\n\nQuesta è una conferma automatica; la richiesta non è ancora una prenotazione.\n\nCordiali saluti,\nApartments Rašpolić"],
][$jezik];
$fdg = fn($d) => (new DateTimeImmutable($d))->format($jezik === 'hr' ? 'j. n. Y.' : ($jezik === 'en' ? 'j M Y' : 'd.m.Y'));
$bilo = ['hr' => 'apartman', 'en' => 'an apartment', 'de' => 'eine Wohnung', 'it' => 'un appartamento'][$jezik];
$kuca = ['hr' => 'cijelu kuću', 'en' => 'the whole house', 'de' => 'das ganze Haus', 'it' => 'tutta la casa'][$jezik];
$sto = $cijelaKuca ? $kuca : ($aps ? implode(', ', array_column($aps, 'naziv')) : $bilo);
posalji_mail($email, $P[0] . ' – Apartments Rašpolić', sprintf($P[1], $ime, $sto, $fdg($od), $fdg($do)), $c['email_upiti']);

json_odgovor(['ok' => true]);
