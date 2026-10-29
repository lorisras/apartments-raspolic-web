<?php
// Kopirajte u /home/KORISNIK/web-podaci/config.php (IZVAN public_html) i upišite svoje podatke.
// Ova datoteka se nikad ne prenosi deployem i nikad ne ide u git.
return [
    'naziv' => 'Apartments Rašpolić',

    // Mapa za podatke weba (cijene, zatvaranja, kalendari). Najbolje ista mapa kao ova datoteka.
    'podaci' => __DIR__,

    // Kamo stižu upiti s weba i s koje adrese se šalju (adresa mora biti na vašoj domeni zbog SPF/DKIM).
    'email_upiti' => 'info@apartments-raspolic.com',
    'email_od' => 'web@apartments-raspolic.com',

    // Kamo stiže upozorenje ako se neki kalendar ne može dohvatiti dulje od 24 h ('' = ne šalji).
    'email_upozorenja' => 'info@apartments-raspolic.com',

    // Korisnici admina: ime => hash lozinke. Hash napravite naredbom:
    //   php -r 'echo password_hash("VAŠA-LOZINKA", PASSWORD_DEFAULT), "\n";'
    // (ili na hostingu: cPanel → Terminal). Lozinka barem 12 znakova.
    'admin' => [
        'loris' => '$2y$10$ZAMIJENITE.OVO.SVOJIM.HASHOM.................................',
    ],
];
