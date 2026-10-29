<?php
declare(strict_types=1);
require __DIR__ . '/auth.php';

$nonce = base64_encode(random_bytes(16));
sigurnosna_zaglavlja($nonce);
$poruka = null;

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    provjeri_csrf();
    if (isset($_POST['ime'])) $poruka = prijava(trim((string)$_POST['ime']), (string)($_POST['lozinka'] ?? ''));
    elseif (isset($_POST['kod'])) $poruka = prijava_kod((string)$_POST['kod']);
    elseif (isset($_POST['odustani'])) { odjava(); $poruka = 'kraj'; }
    if ($poruka === null || $poruka === 'kod' || $poruka === 'kraj') { header('Location: ./', true, 303); exit; }
}
$korisnik = prijavljen();
$cekaKod = $korisnik ? null : ceka_kod();
$e = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
?><!doctype html>
<html lang="hr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="csrf" content="<?= $e(csrf_token()) ?>">
<title>Admin – Apartments Rašpolić</title>
<link rel="stylesheet" href="admin.css">
</head>
<body>
<?php if (!$korisnik && $cekaKod): ?>
<main class="prijava">
  <form method="post" class="kartica" autocomplete="off">
    <p class="znak">APARTMENTS <b>Rašpolić</b></p>
    <h1>Kod za prijavu</h1>
    <p class="mala">Upišite 6 brojki iz aplikacije Google Authenticator na mobitelu (ili jedan od rezervnih kodova).</p>
    <input type="hidden" name="csrf" value="<?= $e(csrf_token()) ?>">
    <label>Kod<input name="kod" inputmode="numeric" autocomplete="one-time-code" maxlength="12" required autofocus></label>
    <?php if ($poruka): ?><p class="greska" role="alert"><?= $e($poruka) ?></p><?php endif; ?>
    <button class="gumb glavni" type="submit">Prijava</button>
  </form>
  <form method="post" class="odustani"><input type="hidden" name="csrf" value="<?= $e(csrf_token()) ?>"><button class="poveznica" name="odustani" value="1">Natrag na prijavu</button></form>
</main>
<?php elseif (!$korisnik): ?>
<main class="prijava">
  <form method="post" class="kartica" autocomplete="on">
    <p class="znak">APARTMENTS <b>Rašpolić</b></p>
    <h1>Prijava</h1>
    <input type="hidden" name="csrf" value="<?= $e(csrf_token()) ?>">
    <label>Korisničko ime<input name="ime" autocomplete="username" autocapitalize="none" required></label>
    <label>Lozinka<input name="lozinka" type="password" autocomplete="current-password" required></label>
    <?php if ($poruka): ?><p class="greska" role="alert"><?= $e($poruka) ?></p><?php endif; ?>
    <button class="gumb glavni" type="submit">Prijava</button>
  </form>
</main>
<?php else: ?>
<header class="traka">
  <span class="znak">APARTMENTS <b>Rašpolić</b> · admin</span>
  <nav class="kartice" aria-label="Izbornik">
    <button type="button" data-k="cijene" aria-current="true">Cijene po danima</button>
    <button type="button" data-k="osnovno">Osnovne cijene</button>
    <button type="button" data-k="zatvoreno">Zatvoreno</button>
    <button type="button" data-k="kalendari">Kalendari</button>
    <button type="button" data-k="sigurnost">Sigurnost</button>
  </nav>
  <span class="tko"><?= $e($korisnik) ?> · <button type="button" class="poveznica" id="odjava">Odjava</button></span>
</header>
<main id="app"><p class="prazno">Učitavanje…</p></main>
<div id="poruka" class="poruka" role="status" hidden></div>
<script src="qrcode.js" nonce="<?= $e($nonce) ?>"></script>
<script type="module" src="admin.js" nonce="<?= $e($nonce) ?>"></script>
<?php endif; ?>
</body>
</html>
