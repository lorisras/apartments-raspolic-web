<?php
// Prijava u admin: sesija, CSRF, blokada nakon krivih pokušaja. Ne poziva se izravno (.htaccess).
declare(strict_types=1);
require dirname(__DIR__) . '/api/lib.php';

const SESIJA_TRAJANJE = 30 * 86400;

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

function prijavljen(): ?string {
    sesija_start();
    $k = $_SESSION['korisnik'] ?? null;
    if (!$k || !isset(konfig()['admin'][$k]) || ($_SESSION['do'] ?? 0) < time()) return null;
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

/** Vraća poruku greške ili null ako je prijava uspjela. */
function prijava(string $ime, string $lozinka): ?string {
    $ip = 'prijava|' . klijent_ip();
    if (!ogranicenje($ip, 8, 900, false)) return 'Previše pokušaja. Pokušajte za 15 minuta.';
    $hash = konfig()['admin'][$ime] ?? null;
    static $lazni = null;                                   // slično vrijeme odgovora i za nepostojeće ime
    $lazni ??= password_hash(bin2hex(random_bytes(8)), PASSWORD_DEFAULT);
    $ok = password_verify($lozinka, $hash ?? $lazni);
    if (!$hash || !$ok) { ogranicenje($ip, 8, 900); return 'Pogrešno korisničko ime ili lozinka.'; }
    ogranicenje_ponisti($ip);
    session_regenerate_id(true);
    $_SESSION['korisnik'] = $ime;
    $_SESSION['do'] = time() + SESIJA_TRAJANJE;
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return null;
}

function odjava(): void {
    sesija_start();
    $_SESSION = [];
    session_destroy();
}
