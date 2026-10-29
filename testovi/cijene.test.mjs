import assert from 'node:assert/strict';
import * as C from '../public/js/cijene.js';

const cj = { osnovnaZa: 2, dodatak: { tip: 'iznos', vrijednost: 15 }, minNoci: 1,
  godine: { '2027': { cijena: 100, sezone: [{ od: '06-01', do: '09-30', cijena: 120, minNoci: 3 }, { od: '12-20', do: '01-05', cijena: 90 }] } },
  dani: { '2027-07-14': 110 } };
const ap = { maxOsoba: 3, cjenik: cj, zauzeto: [['2027-07-20', '2027-07-25']] };

assert.equal(C.cijenaDana(cj, '2027-03-01'), 100);
assert.equal(C.cijenaDana(cj, '2027-07-13'), 120);
assert.equal(C.cijenaDana(cj, '2027-07-14'), 110);
assert.equal(C.cijenaDana(cj, '2027-12-31'), 90);
assert.equal(C.cijenaDana(cj, '2027-01-03'), 90, 'sezona preko Nove godine');
assert.equal(C.cijenaDana(cj, '2028-01-03'), null, 'nema cjenika za 2028');
assert.equal(C.minNociZa(cj, '2027-07-01'), 3);
assert.equal(C.minNociZa(cj, '2027-03-01'), 1);

let r = C.izracun(ap, '2027-07-13', '2027-07-16', { odrasli: 2 });
assert.equal(r.ukupno, 120 + 110 + 120); assert.equal(r.greska, null);
r = C.izracun(ap, '2027-07-13', '2027-07-16', { odrasli: 2, djeca: 1 });
assert.equal(r.ukupno, 350 + 3 * 15); assert.equal(r.dodatnihOsoba, 1);
r = C.izracun(ap, '2027-07-13', '2027-07-16', { odrasli: 4 });
assert.equal(r.greska, 'kapacitet');
r = C.izracun(ap, '2027-07-18', '2027-07-21', { odrasli: 2 });
assert.equal(r.greska, 'zauzeto');
r = C.izracun(ap, '2027-07-25', '2027-07-28', { odrasli: 2 });
assert.equal(r.greska, null, 'dan odlaska je slobodan');
r = C.izracun(ap, '2027-07-10', '2027-07-20', { odrasli: 2 });
assert.equal(r.greska, null, 'odlazak na dan dolaska idućeg gosta');
r = C.izracun(ap, '2027-07-01', '2027-07-03', { odrasli: 2 });
assert.equal(r.greska, 'minNoci'); assert.equal(r.ukupno, 240);
r = C.izracun({ ...ap, cjenik: { ...cj, dodatak: { tip: 'postotak', vrijednost: 20 } } }, '2027-03-01', '2027-03-03', { odrasli: 3 });
assert.equal(r.ukupno, 2 * 120);
r = C.izracun(ap, '2027-12-30', '2028-01-02', { odrasli: 2 });
assert.equal(r.greska, 'bezCijene');
assert.equal(C.najnizaCijena(cj, '2027-03-01', 300), 90);
assert.equal(C.brojNoci('2027-03-30', '2027-04-02'), 3, 'prelazak na ljetno vrijeme');

// više apartmana
const cjen = (c, za, dod = 0) => ({ osnovnaZa: za, dodatak: { tip: 'iznos', vrijednost: dod }, godine: { '2027': { cijena: c } } });
const kuca = [
  { oznaka: 'no-1', maxOsoba: 3, zauzeto: [], cjenik: cjen(100, 2, 15) },
  { oznaka: 'no-2', maxOsoba: 4, zauzeto: [], cjenik: cjen(120, 4) },
  { oznaka: 'no-3', maxOsoba: 5, zauzeto: [['2027-05-02', '2027-05-04']], cjenik: cjen(140, 4, 20) },
  { oznaka: 'no-5', maxOsoba: 5, zauzeto: [], cjenik: cjen(140, 4, 20) },
  { oznaka: 'studio', maxOsoba: 2, zauzeto: [], cjenik: cjen(80, 2) },
];
assert.deepEqual(C.rasporedOsoba(kuca.slice(0, 2), 5), [2, 3], 'prvo do osnovnog broja (bez dodatka)');
assert.deepEqual(C.rasporedOsoba(kuca.slice(0, 2), 7), [3, 4]);
assert.equal(C.rasporedOsoba(kuca.slice(0, 2), 8), null);
r = C.izracunVise(kuca.slice(0, 2), '2027-05-01', '2027-05-03', { odrasli: 6, djeca: 1 });
assert.equal(r.ukupno, 2 * (100 + 15) + 2 * 120);
r = C.izracunVise([kuca[0], kuca[2]], '2027-05-01', '2027-05-03', { odrasli: 4 });
assert.equal(r.greska, 'zauzeto'); assert.deepEqual(r.zauzeti, ['no-3']);
const k = C.kombinacije(kuca, '2027-05-01', '2027-05-03', { odrasli: 8 });
assert.ok(k.every((x) => !x.apartmani.some((a) => a.oznaka === 'no-3')), 'zauzeti se ne predlažu');
assert.deepEqual(k[0].apartmani.map((a) => a.oznaka), ['no-2', 'no-5'], 'najjeftinija kombinacija s 2 apartmana (bez dodatka za osobe)');
assert.deepEqual(k.map((x) => x.apartmani.length), [2, 2, 3], 'prvo manje apartmana');
assert.equal(C.kombinacije(kuca, '2027-05-01', '2027-05-03', { odrasli: 15 }).length, 0, 'premalo slobodnih mjesta');
console.log('cijene.js: svi testovi prošli');
