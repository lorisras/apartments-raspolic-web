# Apartments Rašpolić – web

Web za 7 apartmana na Trinajstići 31B (Kastav): 4 jezika (HR, EN, DE, IT), kalendar zauzetosti iz Bookinga i Airbnba, cijene po danima, upiti na e-mail te WhatsApp i Viber. Potpuno odvojen od aplikacije Računi.

- **Astro** gradi statične stranice (HTML, CSS, JS) iz predložaka i sadržaja.
- **PHP** na hostingu: zauzetost i cijene (`/api/podaci.php`), slanje upita (`/api/upit.php`), dohvat iCal kalendara (cron) i admin (`/admin/`).
- Podaci koji se mijenjaju (cijene, zatvaranja, iCal poveznice) su JSON datoteke u mapi **`web-podaci/` izvan `public_html`**. Deploy ih nikad ne dira.

## Gdje je što

| Što mijenjate | Gdje | Kako se objavljuje |
| --- | --- | --- |
| Cijene po danima, osnovne cijene, sezone, dodatak za osobu, min. noćenja | `apartments-raspolic.com/admin/` | Odmah |
| Zatvaranje termina samo na webu | admin → Zatvoreno | Odmah |
| iCal poveznice, % za Booking i Airbnb | admin → Kalendari | Odmah |
| Opis, raspored spavanja i oprema apartmana | `src/content/apartmani/<oznaka>/<jezik>.md` | `git push` |
| Fotografije apartmana | `src/assets/apartmani/<oznaka>/` (01-…, 02-…; prva je naslovna) | `git push` |
| Fotografije kuće (prva = velika na naslovnici) | `src/assets/kuca/` | `git push` |
| m², kat, broj osoba, zvjezdice, reg. broj, Airbnb ocjena, telefon, WhatsApp, Viber, e-mail | `src/data/apartmani.json` | `git push` |
| Tekstovi sučelja (izbornik, naslovnica, obrazac…) | `src/i18n/ui.js` | `git push` |
| Boje i fontovi | `src/styles/global.css` | `git push` |

Oznake apartmana: `no-1` … `no-5`, `studio`, `studio-loft`.

## Rad na računalu

```bash
npm install
npm run dev      # http://localhost:4321 – stranice se osvježavaju dok mijenjate datoteke
npm test         # testovi izračuna cijena
npm run build    # gotov web u mapi dist/
```

U `npm run dev` kalendar i cijene su prazni jer nema PHP-a. Za potpuni lokalni test (s PHP-om):

```bash
npm run build
mkdir -p ../web-podaci && cp posluzitelj/config.primjer.php ../web-podaci/config.php   # upišite podatke
php -S localhost:8000 -t dist
```

(`config.php` traži se u mapi `web-podaci` do 3 razine iznad mape weba.)

## Prva postavka na Plus Hostingu

1. **Domena i SSL**: apartments-raspolic.com usmjerena na hosting, AutoSSL uključen (cPanel → SSL/TLS Status).
2. **Mapa za podatke**: u početnoj mapi hostinga (`/home/KORISNIK/`, iznad `public_html`) napravite `web-podaci` i u nju kopirajte `posluzitelj/config.primjer.php` kao `config.php`. Upišite e-mail adrese.
3. **Lozinka za admin**: napravite hash lozinke (cPanel → Terminal ili na svom računalu):
   `php -r 'echo password_hash("VAŠA-LOZINKA", PASSWORD_DEFAULT), "\n";'`
   i zalijepite ga u `config.php` pod `'admin'`. Može ih biti više (npr. i Alen).
4. **E-mail**: u cPanelu napravite adresu `web@apartments-raspolic.com` (s nje se šalju upiti) i uključite **Email Deliverability** (SPF i DKIM) za domenu, da upiti ne završe u spamu.
5. **FTP račun** s početnom mapom `public_html` (cPanel → FTP Accounts).
6. **GitHub**: novi privatni repozitorij, u njega ovaj projekt. U Settings → Secrets and variables → Actions dodajte `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`. Svaki `git push` na `main` sam gradi web i prenosi ga (Actions → Deploy).
7. **Cron** (cPanel → Cron Jobs), svakih 30 minuta:
   `/usr/local/bin/php /home/KORISNIK/public_html/api/ical-sync.php --tiho`
   (točnu putanju do PHP-a pokazuje cPanel na stranici Cron Jobs).
8. **Admin**: prijavite se na `/admin/`, u **Kalendari** zalijepite iCal poveznice za svih 7 apartmana (Booking i Airbnb) i kliknite „Osvježi kalendare sada“. U **Osnovne cijene** upišite cijene, sezone i dodatke.

## Kako radi

- **Zauzetost**: cron dohvaća 14 iCal kalendara (samo HTTPS adrese Bookinga i Airbnba, najviše 2 MB, 15 s) i iz njih čita samo datume. Imena gostiju, poveznice i brojevi telefona se ne spremaju. Ako neki kalendar ne radi, koristi se zadnji uspješan, a nakon 24 h stiže e-mail upozorenje. Dan odlaska je slobodan za novi dolazak.
- **Cijene**: cijena dana = ručno postavljena cijena tog dana, inače cijena sezone, inače osnovna cijena godine. Dodatak (€ po noći ili % cijene noći) plaća se za svaku osobu iznad „osnovna cijena vrijedi za“. Bebe do 2 godine se ne broje ni u broj osoba ni u dodatak. Ista pravila su u `public/js/cijene.js` (web i admin) i `public/api/lib.php`.
- **Upiti**: obrazac šalje e-mail na `email_upiti` (Reply-To = gost) i kratku potvrdu gostu na njegovom jeziku. Ništa se ne sprema na poslužitelju. Zaštita: skriveno polje, najmanje 3 s ispunjavanja, najviše 5 upita na sat s iste adrese. Ako je termin u međuvremenu zauzet, e-mail to označi.
- **Admin**: prijava lozinkom (bcrypt), blokada 15 min nakon 8 krivih pokušaja, CSRF zaštita, kolačić Secure/HttpOnly/SameSite=Strict, sesija 30 dana. Svaka promjena odmah vrijedi na webu.

## Prije objave

- [ ] Fotografije u originalu u `src/assets/`
- [ ] Opisi apartmana no. 2 – Studio loft na 4 jezika (`src/content/apartmani/`)
- [ ] m², kat i broj spavaćih soba za no. 2 – Studio loft (`src/data/apartmani.json`)
- [ ] Broj za WhatsApp i Viber, telefon i e-mail (`src/data/apartmani.json` → `kuca`)
- [ ] Koordinate kuće za kartu (`kuca.geo`)
- [ ] Impressum (OIB i ostalo) i puni tekst politike privatnosti
- [ ] Pregled njemačkog i talijanskog teksta (izvorni govornik)
- [ ] Vrijeme prijave i odjave, kućni ljubimci, pušenje (još nije na webu)
