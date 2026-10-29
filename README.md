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

## Prva postavka na Plus Hostingu (napravljeno 29.10.2026.)

Korisnik hostinga je `apartments`, početna mapa `/home/apartments`.

1. **WordPress** uklonjen (Softaculous). U `public_html` ostaju samo `.well-known` i `cgi-bin` od hostinga.
2. **Zaštita lozinkom dok je web u izradi**: cPanel → Directory Privacy → `public_html` (korisnik `pregled`). Isti redovi su na vrhu `public/.htaccess` jer bi ih prijenos inače prepisao. **Kad web ide u javnost, obrišite tih 5 redaka** i isključite zaštitu u cPanelu.
3. **Mapa za podatke**: `/home/apartments/web-podaci/` s `config.php` (predložak `posluzitelj/config.primjer.php`). Nikad ne ide na GitHub.
4. **Lozinka za admin**: hash se upisuje u `config.php` pod `'admin'`. Napravi se privremenom PHP stranicom ili naredbom `php -r 'echo password_hash("LOZINKA", PASSWORD_DEFAULT), "\n";'`.
5. **Još treba**: e-mail adresa `web@apartments-raspolic.com` i **Email Deliverability** (SPF, DKIM); **cron** (cPanel → Cron Jobs, svakih 30 min): `/usr/local/bin/php /home/apartments/public_html/api/ical-sync.php --tiho`; iCal poveznice u adminu → Kalendari.

## Objava promjena (ručni prijenos)

Plus Hosting nema uključen FTPS, pa se web ne prenosi automatski. Postupak:

1. Promjene → `git add .` → `git commit -m "…"` → `git push`.
2. GitHub izgradi web (Actions → **Build**, zelena kvačica).
3. Na tom pokretanju, dolje pod **Artifacts**, preuzmite **web-za-hosting** (zip).
4. cPanel → File Manager → `public_html` → **Upload** zipa → desni klik → **Extract** u `/public_html` → obrišite zip.

Datoteke koje su u novoj verziji obrisane ostaju na hostingu dok ih ne obrišete ručno (rijetko je važno).
Ako Plus Hosting uključi FTPS, automatski prijenos se vraća u `.github/workflows/deploy.yml` (FTP-Deploy-Action).

## Dvofaktorska prijava u admin

Admin → **Sigurnost** → lozinka → QR kod u Google Authenticatoru → kod → 8 rezervnih kodova (spremiti, prikazuju se jednom).
Izgubljen mobitel i rezervni kodovi: cPanel → File Manager → `web-podaci` → obrišite `dvofaktorska.json`, pa se prijavite samo lozinkom i ponovno uključite 2FA.

## Kako radi

- **Zauzetost**: cron dohvaća 14 iCal kalendara (samo HTTPS adrese Bookinga i Airbnba, najviše 2 MB, 15 s) i iz njih čita samo datume. Imena gostiju, poveznice i brojevi telefona se ne spremaju. Ako neki kalendar ne radi, koristi se zadnji uspješan, a nakon 24 h stiže e-mail upozorenje. Dan odlaska je slobodan za novi dolazak.
- **Cijene**: cijena dana = ručno postavljena cijena tog dana, inače cijena sezone, inače osnovna cijena godine. Dodatak (€ po noći ili % cijene noći) plaća se za svaku osobu iznad „osnovna cijena vrijedi za“. Bebe do 2 godine se ne broje ni u broj osoba ni u dodatak. Ista pravila su u `public/js/cijene.js` (web i admin) i `public/api/lib.php`.
- **Osnovne cijene** (admin): razdoblja (npr. 15.6.–15.9.) su zajednička za sve apartmane, cijene se upisuju u tablicu apartmani × razdoblja. Spremaju se kao sezone svakog apartmana u `cijene.json` (+ `razdoblja` po godini). Gumb „Popuni iz Računa“ upisuje cjenik 2026. i 2027. iz aplikacije Računi (samo u polja, sprema se gumbom Spremi).
- **Grupe**: naslovnica ima dio „Grupe i obitelji“ (cijela kuća do 25 osoba, dulji boravci). Kad u tražilici nijedan slobodan apartman nije dovoljno velik, web predlaže kombinacije slobodnih apartmana s okvirnom cijenom (osobe se raspoređuju tako da dodatak bude najmanji). U upitu se može odabrati više apartmana ili „Cijela kuća“.
- **Upiti**: obrazac šalje e-mail na `email_upiti` (Reply-To = gost) i kratku potvrdu gostu na njegovom jeziku. Ništa se ne sprema na poslužitelju. Zaštita: skriveno polje, najmanje 3 s ispunjavanja, najviše 5 upita na sat s iste adrese. Ako je termin u međuvremenu zauzet, e-mail to označi.
- **Admin**: prijava lozinkom (bcrypt) i po želji kodom s mobitela (TOTP, rezervni kodovi), blokada 15 min nakon 8 krivih pokušaja, CSRF zaštita, kolačić Secure/HttpOnly/SameSite=Strict, sesija 30 dana. Svaka promjena odmah vrijedi na webu.

## Prije objave

- [ ] Fotografije u originalu u `src/assets/`
- [x] Opisi apartmana na 4 jezika – iz Airbnb oglasa, provjeriti (`src/content/apartmani/`)
- [x] m², kat, spavaće sobe i Airbnb ocjene (`src/data/apartmani.json`)
- [ ] Broj za WhatsApp i Viber, telefon i e-mail (`src/data/apartmani.json` → `kuca`)
- [ ] Koordinate kuće za kartu (`kuca.geo`)
- [ ] Impressum (OIB i ostalo) i puni tekst politike privatnosti
- [ ] Pregled njemačkog i talijanskog teksta (izvorni govornik)
- [ ] Vrijeme prijave i odjave, kućni ljubimci, pušenje (još nije na webu)
