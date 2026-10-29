// Naslovnica: „od X €“ na karticama, a nakon odabira datuma slobodno/zauzeto i ukupna cijena za svaki apartman.
import { izracun, najnizaCijena, danas } from './cijene.js';
import { T, podaci, eur, nociTekst, izUrla, uUrl, veziDatume } from './zajednicko.js';

const APS = JSON.parse(document.getElementById('apartmani-podaci').textContent);
const forma = document.getElementById('trazi');
const polje = (n) => forma.querySelector(`[name=${n}]`);
const kartice = Object.fromEntries([...document.querySelectorAll('.kartica-ap')].map((k) => [k.dataset.oznaka, k]));

const pocetno = izUrla();
if (pocetno.od) polje('od').value = pocetno.od;
if (pocetno.do) polje('do').value = pocetno.do;
['odrasli', 'djeca', 'bebe'].forEach((n) => { if (polje(n).querySelector(`option[value="${pocetno[n]}"]`)) polje(n).value = pocetno[n]; });
veziDatume(polje('od'), polje('do'));

const odabir = () => ({ od: polje('od').value, do: polje('do').value, odrasli: +polje('odrasli').value, djeca: +polje('djeca').value, bebe: +polje('bebe').value });

async function osvjezi() {
  const P = await podaci();
  const o = odabir();
  const imaDatume = o.od && o.do && o.do > o.od;
  for (const a of APS) {
    const k = kartice[a.oznaka];
    if (!k) continue;
    const cijenaEl = k.querySelector('[data-cijena]'), status = k.querySelector('[data-status]');
    const p = P?.apartmani?.[a.oznaka];
    k.href = imaDatume ? uUrl(a.url, o) : a.url;
    k.classList.remove('nedostupno');
    if (!p) { cijenaEl.textContent = ''; status.hidden = true; continue; }
    if (!imaDatume) {
      const min = najnizaCijena(p.cjenik, danas());
      cijenaEl.innerHTML = min == null ? T.na_upit : `${T.od_cijena} <b>${eur(min)}</b> ${T.po_noci}`;
      status.hidden = true;
      continue;
    }
    const r = izracun({ maxOsoba: a.maxOsoba, zauzeto: p.zauzeto, cjenik: p.cjenik }, o.od, o.do, o);
    status.hidden = false;
    if (r.greska === 'kapacitet') {
      status.className = 'oznaka siva'; status.textContent = T.previse_osoba; cijenaEl.textContent = ''; k.classList.add('nedostupno');
    } else if (r.greska === 'zauzeto') {
      status.className = 'oznaka zauzeto'; status.textContent = T.zauzeto; cijenaEl.textContent = ''; k.classList.add('nedostupno');
    } else {
      status.className = 'oznaka ok'; status.textContent = T.slobodno;
      cijenaEl.innerHTML = r.ukupno == null ? T.na_upit : `${nociTekst(r.noci)} · <b>${eur(r.ukupno)}</b>`;
    }
  }
}

forma.addEventListener('submit', (e) => {
  e.preventDefault();
  const o = odabir();
  history.replaceState(null, '', uUrl(location.pathname, o) + '#apartmani');
  osvjezi();
  document.getElementById('apartmani').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  // i u obrazac za upit na dnu stranice
  const u = document.querySelector('.obrazac-upita');
  if (u && o.od) { u.querySelector('[name=od]').value = o.od; u.querySelector('[name=do]').value = o.do; u.dispatchEvent(new Event('osvjezi')); }
});
forma.addEventListener('change', () => { if (polje('od').value && polje('do').value) osvjezi(); });
osvjezi();
