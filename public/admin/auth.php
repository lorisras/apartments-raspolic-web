<?php
// Prijava u admin: sesija, CSRF, blokada nakon krivih pokušaja, dvofaktorska prijava (TOTP). Ne poziva se izravno (.htaccess).
declare(strict_types=1);
require dirname(__DIR__) . '/api/lib.php';

const SESIJA_TRAJANJE = 30 * 86400;
const DRUGI_KORAK_TRAJANJE = 300;        // 5 min za upis koda nakon lozinke
const DRUGI_KORAK_POKUSAJA = 5;

function sesija_start(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $https = ($_SERVER['HTTPS'] ?? '') === 'on' || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
    $mapa = put('sesije');
    if (!is_dir($mapa)) @mkdir($mapa, 0750, true);
    session_save_path($mapa);
    session_name($https ? '__Host-admin' : 'admin');
    session_set_cookie_params(['lifetime' => SESIJA_TRAJANJE, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
    ini_set('session.gc_maxlifetime', (string)SESIJA_TRAJANJE);
    ini_set('session.use_strict_mode', '1');
    session_start();
}

function sigurnosna_zaglavlja(?string $nonce = null): void {
    header('X-Frame-Options: DENY');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
    header('Cache-Control: no-store');
    if ($nonce) header("Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-$nonce'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
}

/** Prijavljeni korisnik ili null. Sesija vrijedi samo ako se 2FA nije mijenjala otkad je otvorena. */
function prijavljen(): ?string {
    sesija_start();
    $k = $_SESSION['korisnik'] ?? null;
    if (!$k || !isset(konfig()['admin'][$k]) || ($_SESSION['do'] ?? 0) < time()) return null;
    if (($_SESSION['ver'] ?? '') !== tfa_verzija($k)) return null;
    return $k;
}

function csrf_token(): string {
    sesija_start();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
}

function provjeri_csrf(): void {
    $t = $_SERVER['HTTP_X_CSRF'] ?? ($_POST['csrf'] ?? '');
    if (!is_string($t) || !hash_equals(csrf_token(), $t)) json_odgovor(['greska' => 'csrf'], 403);
}

function provjeri_lozinku(string $ime, string $lozinka): bool {
    static $lazni = null;                                   // slično vrijeme odgovora i za nepostojeće ime
    $lazni ??= password_hash(bin2hex(random_bytes(8)), PASSWORD_DEFAULT);
    $hash = konfig()['admin'][$ime] ?? null;
    return password_verify($lozinka, $hash ?? $lazni) && $hash !== null;
}

/**
 * Prvi korak prijave. Vraća null (prijavljen), 'kod' (traži se kod iz aplikacije) ili poruku greške.
 */
function prijava(string $ime, string $lozinka): ?string {
    $ip = 'prijava|' . klijent_ip();
    if (!ogranicenje($ip, 8, 900, false) || !ogranicenje("korisnik|$ime", 20, 900, false)) return 'Previše pokušaja. Pokušajte za 15 minuta.';
    if (!provjeri_lozinku($ime, $lozinka)) { ogranicenje($ip, 8, 900); ogranicenje("korisnik|$ime", 20, 900); return 'Pogrešno korisničko ime ili lozinka.'; }
    session_regenerate_id(true);
    if (tfa_ukljucen($ime)) {
        $_SESSION = ['drugi_korak' => ['ime' => $ime, 'do' => time() + DRUGI_KORAK_TRAJANJE, 'pokusaja' => 0], 'csrf' => bin2hex(random_bytes(32))];
        return 'kod';
    }
    ogranicenje_ponisti($ip);
    prijavi($ime);
    return null;
}

/** Ime korisnika koji je upisao lozinku i čeka na kod, ili null. */
function ceka_kod(): ?string {
    sesija_start();
    $d = $_SESSION['drugi_korak'] ?? null;
    if (!$d || $d['do'] < time()) { unset($_SESSION['drugi_korak']); return null; }
    return $d['ime'];
}

/** Drugi korak: kod iz aplikacije ili rezervni kod. Vraća null (prijavljen) ili poruku greške. */
function prijava_kod(string $kod): ?string {
    $ime = ceka_kod();
    if (!$ime) return 'Vrijeme za upis koda je isteklo. Prijavite se ponovno.';
    $ip = 'prijava|' . klijent_ip();
    if (!ogranicenje($ip, 8, 900, false)) return 'Previše pokušaja. Pokušajte za 15 minuta.';
    if (tfa_provjeri($ime, $kod)) {
        ogranicenje_ponisti($ip);
        prijavi($ime);
        return null;
    }
    ogranicenje($ip, 8, 900);
    if (++$_SESSION['drugi_korak']['pokusaja'] >= DRUGI_KORAK_POKUSAJA) { unset($_SESSION['drugi_korak']); return 'Previše krivih kodova. Prijavite se ponovno.'; }
    return 'Kod nije točan.';
}

function prijavi(string $ime): void {
    session_regenerate_id(true);
    $_SESSION = ['korisnik' => $ime, 'do' => time() + SESIJA_TRAJANJE, 'csrf' => bin2hex(random_bytes(32)), 'ver' => tfa_verzija($ime)];
}

function odjava(): void {
    sesija_start();
    $_SESSION = [];
    session_destroy();
}

// ---------------------------------------------------------------------------
// Dvofaktorska prijava (TOTP, RFC 6238) – Google Authenticator, Microsoft Authenticator…
// Podaci u web-podaci/dvofaktorska.json: { ime: { tajna, zadnji, rezerva: [bcrypt…], ver } }
// Hitni slučaj (izgubljen mobitel i rezervni kodovi): u File Manageru obrisati dvofaktorska.json.
// ---------------------------------------------------------------------------

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function b32_kodiraj(string $bajtovi): string {
    $bitovi = '';
    foreach (str_split($bajtovi) as $c) $bitovi .= str_pad(decbin(ord($c)), 8, '0', STR_PAD_LEFT);
    $out = '';
    foreach (str_split($bitovi, 5) as $dio) $out .= B32[bindec(str_pad($dio, 5, '0'))];
    return $out;
}

function b32_dekodiraj(string $s): string {
    $s = strtoupper(preg_replace('/[\s=]/', '', $s));
    $bitovi = '';
    foreach (str_split($s) as $c) { $i = strpos(B32, $c); if ($i === false) return ''; $bitovi .= str_pad(decbin($i), 5, '0', STR_PAD_LEFT); }
    $out = '';
    foreach (str_split($bitovi, 8) as $b) if (strlen($b) === 8) $out .= chr(bindec($b));
    return $out;
}

function totp_kod(string $tajnaB32, int $korak): string {
    $h = hash_hmac('sha1', pack('J', $korak), b32_dekodiraj($tajnaB32), true);
    $o = ord($h[19]) & 0x0f;
    $n = ((ord($h[$o]) & 0x7f) << 24) | (ord($h[$o + 1]) << 16) | (ord($h[$o + 2]) << 8) | ord($h[$o + 3]);
    return str_pad((string)($n % 1000000), 6, '0', STR_PAD_LEFT);
}

/** Korak (30 s) za koji kod vrijedi (dopušten ±1 korak zbog sata na mobitelu), ili null. Kod se ne može ponoviti. */
function totp_provjeri(string $tajna, string $kod, int $zadnji): ?int {
    if (!preg_match('/^\d{6}$/', $kod)) return null;
    $sad = intdiv(time(), 30);
    foreach ([$sad - 1, $sad, $sad + 1] as $k) {
        if ($k > $zadnji && hash_equals(totp_kod($tajna, $k), $kod)) return $k;
    }
    return null;
}

function tfa_svi(): array { return citaj('dvofaktorska.json'); }
function tfa_ukljucen(string $ime): bool { return !empty(tfa_svi()[$ime]['tajna']); }
function tfa_verzija(string $ime): string { return (string)(tfa_svi()[$ime]['ver'] ?? ''); }
function tfa_rezervnih(string $ime): int { return count(tfa_svi()[$ime]['rezerva'] ?? []); }

/** Kod iz aplikacije ili rezervni kod (vrijedi jednom). */
function tfa_provjeri(string $ime, string $kod): bool {
    $kod = preg_replace('/[\s-]/', '', $kod);
    return (bool)uz_bravu(function () use ($ime, $kod) {
        $svi = tfa_svi();
        $u = $svi[$ime] ?? null;
        if (!$u || empty($u['tajna'])) return false;
        $korak = totp_provjeri($u['tajna'], $kod, (int)($u['zadnji'] ?? 0));
        if ($korak !== null) { $svi[$ime]['zadnji'] = $korak; zapisi('dvofaktorska.json', $svi); return true; }
        foreach ($u['rezerva'] ?? [] as $i => $h) {
            if (password_verify(strtolower($kod), $h)) {
                array_splice($svi[$ime]['rezerva'], $i, 1);
                zapisi('dvofaktorska.json', $svi);
                return true;
            }
        }
        return false;
    });
}

function tfa_nova_tajna(): string { return b32_kodiraj(random_bytes(20)); }

function tfa_otpauth(string $ime, string $tajna): string {
    $oznaka = rawurlencode('Apartments Rašpolić web') . ':' . rawurlencode($ime);
    return "otpauth://totp/$oznaka?secret=$tajna&issuer=" . rawurlencode('Apartments Rašpolić web') . '&algorithm=SHA1&digits=6&period=30';
}

/** 8 rezervnih kodova (prikazuju se jednom); spremaju se samo kao bcrypt. */
function tfa_rezervni_kodovi(): array {
    $abc = 'abcdefghjkmnpqrstuvwxyz23456789';
    $kodovi = [];
    for ($i = 0; $i < 8; $i++) {
        $k = '';
        for ($j = 0; $j < 10; $j++) $k .= $abc[random_int(0, strlen($abc) - 1)];
        $kodovi[] = substr($k, 0, 5) . '-' . substr($k, 5);
    }
    return $kodovi;
}

function tfa_spremi(string $ime, ?array $podaci): void {
    uz_bravu(function () use ($ime, $podaci) {
        $svi = tfa_svi();
        if ($podaci === null) unset($svi[$ime]); else $svi[$ime] = $podaci;
        zapisi('dvofaktorska.json', $svi);
    });
}
