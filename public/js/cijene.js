// Logika cijena i dostupnosti – zajednička za web i admin.
// Datumi su nizovi 'GGGG-MM-DD'. Raspon zauzetosti [od, do) – dan odlaska je slobodan za novi dolazak.
//
// Cjenik apartmana (iz /api/podaci.php):
// {
//   osnovnaZa: 2,                         // osnovna cijena vrijedi za toliko osoba
//   dodatak: { tip: 'iznos'|'postotak', vrijednost: 15 },  // po noći, za svaku osobu iznad osnovnaZa
//   minNoci: 1,                           // zadani minimalni broj noćenja
//   godine: { '2027': { cijena: 100, minNoci: 2, sezone: [{ od: '06-01', do: '09-30', cijena: 120, minNoci: 3 }] } },
//   dani: { '2027-07-14': 110 }           // ručno postavljene cijene po danu (imaju prednost)
// }
// Sezona: 'od' i 'do' su MM-DD, 'do' je zadnja noć sezone (uključivo). Sezona može prelaziti preko Nove godine.

export const dodajDane = (d, n) => {
  const t = new Date(d + 'T12:00:00Z');
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

export const brojNoci = (od, doo) =>
  od && doo ? Math.max(0, Math.round((Date.parse(doo + 'T12:00:00Z') - Date.parse(od + 'T12:00:00Z')) / 864e5)) : 0;

export const noci = (od, doo) => Array.from({ length: brojNoci(od, doo) }, (_, i) => dodajDane(od, i));

const uSezoni = (md, s) => (s.od <= s.do ? md >= s.od && md <= s.do : md >= s.od || md <= s.do);

function sezonaDana(cj, datum) {
  const g = cj?.godine?.[datum.slice(0, 4)];
  if (!g) return { g: null, s: null };
  return { g, s: (g.sezone || []).find((s) => uSezoni(datum.slice(5), s)) || null };
}

/** Cijena noćenja za osnovni broj osoba, ili null ako nije upisana. */
export function cijenaDana(cj, datum) {
  if (!cj) return null;
  const rucno = cj.dani?.[datum];
  if (rucno != null && rucno !== '') return Number(rucno);
  const { g, s } = sezonaDana(cj, datum);
  const c = s?.cijena ?? g?.cijena;
  return c == null || c === '' ? null : Number(c);
}

/** Minimalni broj noćenja za boravak koji počinje tog dana. */
export function minNociZa(cj, datum) {
  const { g, s } = sezonaDana(cj, datum);
  return Number(s?.minNoci || g?.minNoci || cj?.minNoci || 1);
}

/** Dodatak po noći za jednu osobu iznad osnovnog broja. */
export function dodatakDana(cj, cijena) {
  const d = cj?.dodatak;
  if (!d || !Number(d.vrijednost)) return 0;
  return d.tip === 'postotak' ? Math.round(cijena * Number(d.vrijednost)) / 100 : Number(d.vrijednost);
}

/** Je li noć 'datum' zauzeta. zauzeto = [[od, do], ...] */
export const zauzetDan = (zauzeto, datum) => (zauzeto || []).some(([a, b]) => datum >= a && datum < b);

export const slobodno = (zauzeto, od, doo) => noci(od, doo).every((d) => !zauzetDan(zauzeto, d));

/** Broj osoba koji se računa: bebe (do 2 godine) se ne računaju. */
export const osobeZaRacun = ({ odrasli = 0, djeca = 0 } = {}) => Number(odrasli || 0) + Number(djeca || 0);

/**
 * Izračun boravka.
 * ap = { maxOsoba, zauzeto, cjenik }
 * Vraća { noci, ukupno, poNoci: [{datum, cijena, dodatak}], dodatnihOsoba, greska }
 * greska: 'datumi' | 'kapacitet' | 'zauzeto' | 'bezCijene' | 'minNoci' (minNoci je samo upozorenje – iznos se ipak računa)
 */
export function izracun(ap, od, doo, gosti) {
  const n = brojNoci(od, doo);
  const out = { noci: n, ukupno: null, poNoci: [], dodatnihOsoba: 0, greska: null, minNoci: 1 };
  if (!n) return { ...out, greska: 'datumi' };
  const osoba = osobeZaRacun(gosti);
  if (ap.maxOsoba && osoba > ap.maxOsoba) return { ...out, greska: 'kapacitet' };
  if (!slobodno(ap.zauzeto, od, doo)) return { ...out, greska: 'zauzeto' };
  const cj = ap.cjenik || {};
  const dodatnih = Math.max(0, osoba - Number(cj.osnovnaZa || ap.maxOsoba || osoba));
  let ukupno = 0;
  for (const datum of noci(od, doo)) {
    const c = cijenaDana(cj, datum);
    if (c == null) return { ...out, greska: 'bezCijene' };
    const dod = dodatnih * dodatakDana(cj, c);
    out.poNoci.push({ datum, cijena: c, dodatak: dod });
    ukupno += c + dod;
  }
  out.ukupno = Math.round(ukupno * 100) / 100;
  out.dodatnihOsoba = dodatnih;
  out.minNoci = minNociZa(cj, od);
  if (n < out.minNoci) out.greska = 'minNoci';
  return out;
}

/** Najniža upisana cijena noćenja u sljedećih 'dana' dana (za „od X €“). */
export function najnizaCijena(cj, danas, dana = 365) {
  let min = null;
  for (let i = 0; i < dana; i++) {
    const c = cijenaDana(cj, dodajDane(danas, i));
    if (c != null && (min == null || c < min)) min = c;
  }
  return min;
}

export const danas = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ---------------------------------------------------------------- Više apartmana (grupe, cijela kuća)

/**
 * Raspored osoba po apartmanima tako da je dodatak za osobe što manji:
 * prvo svakom apartmanu po jedna osoba, zatim do osnovnog broja, pa tek onda dodatna mjesta.
 * aps = [{ maxOsoba, cjenik }]. Vraća niz brojeva osoba ili null ako je osoba previše.
 */
export function rasporedOsoba(aps, osoba) {
  const ukupnoMjesta = aps.reduce((z, a) => z + Number(a.maxOsoba || 0), 0);
  if (osoba > ukupnoMjesta) return null;
  const n = aps.map(() => 0);
  const granice = [aps.map(() => 1), aps.map((a) => Math.min(a.maxOsoba, Number(a.cjenik?.osnovnaZa || a.maxOsoba))), aps.map((a) => a.maxOsoba)];
  let ostalo = osoba;
  for (const g of granice) {
    for (let i = 0; i < aps.length && ostalo > 0; i++) {
      const dodaj = Math.min(ostalo, Math.max(0, g[i] - n[i]));
      n[i] += dodaj;
      ostalo -= dodaj;
    }
  }
  return n;
}

/**
 * Izračun za više apartmana zajedno. aps = [{ oznaka, maxOsoba, zauzeto, cjenik }].
 * Vraća { noci, ukupno, osobe: [..], zauzeti: [oznake], greska } – greska kao kod izracun().
 */
export function izracunVise(aps, od, doo, gosti) {
  const n = brojNoci(od, doo);
  const out = { noci: n, ukupno: null, osobe: [], zauzeti: [], greska: null, minNoci: 1 };
  if (!n) return { ...out, greska: 'datumi' };
  const osobe = rasporedOsoba(aps, osobeZaRacun(gosti));
  if (!osobe) return { ...out, greska: 'kapacitet' };
  out.osobe = osobe;
  out.zauzeti = aps.filter((a) => !slobodno(a.zauzeto, od, doo)).map((a) => a.oznaka);
  if (out.zauzeti.length) return { ...out, greska: 'zauzeto' };
  let ukupno = 0, bezCijene = false;
  aps.forEach((a, i) => {
    const r = izracun(a, od, doo, { odrasli: osobe[i] });
    if (r.ukupno == null) bezCijene = true; else ukupno += r.ukupno;
    out.minNoci = Math.max(out.minNoci, r.minNoci || 1);
  });
  if (bezCijene) return { ...out, greska: 'bezCijene' };
  out.ukupno = Math.round(ukupno * 100) / 100;
  if (n < out.minNoci) out.greska = 'minNoci';
  return out;
}

/**
 * Kombinacije slobodnih apartmana za grupu: samo one bez suvišnog apartmana,
 * poredane po broju apartmana, pa po cijeni (ili višku mjesta kad nema cijene). Najviše 'koliko'.
 */
export function kombinacije(aps, od, doo, gosti, koliko = 3) {
  const osoba = osobeZaRacun(gosti);
  const slobodni = aps.filter((a) => slobodno(a.zauzeto, od, doo));
  const mjesta = (k) => k.reduce((z, a) => z + Number(a.maxOsoba || 0), 0);
  const out = [];
  for (let maska = 1; maska < 1 << slobodni.length; maska++) {
    const k = slobodni.filter((_, i) => maska & (1 << i));
    if (mjesta(k) < osoba) continue;
    if (k.some((a) => mjesta(k) - a.maxOsoba >= osoba)) continue;          // neki apartman je višak
    const r = izracunVise(k, od, doo, gosti);
    out.push({ apartmani: k, mjesta: mjesta(k), ukupno: r.ukupno, noci: r.noci });
  }
  out.sort((x, y) => x.apartmani.length - y.apartmani.length
    || (x.ukupno ?? Infinity) - (y.ukupno ?? Infinity)
    || x.mjesta - y.mjesta);
  return out.slice(0, koliko);
}
