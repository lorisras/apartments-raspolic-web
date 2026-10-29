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
