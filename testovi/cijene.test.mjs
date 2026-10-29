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
console.log('cijene.js: svi testovi prošli');
