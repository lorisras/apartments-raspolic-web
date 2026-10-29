// Naslovnica: „od X €“ na karticama, a nakon odabira datuma slobodno/zauzeto i ukupna cijena za svaki apartman.
import { izracun, najnizaCijena, danas, kombinacije, osobeZaRacun, slobodno } from './cijene.js';
import { T, podaci, eur, nociTekst, izUrla, uUrl, veziDatume } from './zajednicko.js';

const APS = JSON.parse(document.getElementById('apartmani-podaci').textContent);
const forma = document.getElementById('trazi');
const polje = (n) => forma.querySelector(`[name=${n}]`);
const grupa = document.getElementById('grupa');
const upit = document.querySelector('.obrazac-upita');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const osobeTekst = (n) => `${n} ${T.osobe?.[new Intl.PluralRules(T.lokal).select(n)] ?? T.osobe?.other}`;
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
  prijedloziZaGrupu(P, o, imaDatume);
}

/** Kad nijedan slobodan apartman nije dovoljno velik, predloži kombinacije slobodnih apartmana. */
function prijedloziZaGrupu(P, o, imaDatume) {
  grupa.hidden = true;
  if (!imaDatume || !P?.apartmani) return;
  const aps = APS.map((a) => ({ ...a, ...P.apartmani[a.oznaka] })).filter((a) => a.cjenik);
  const osoba = osobeZaRacun(o);
  if (aps.some((a) => a.maxOsoba >= osoba && slobodno(a.zauzeto, o.od, o.do))) return;   // jedan apartman je dovoljan
  const k = kombinacije(aps, o.od, o.do, o);
  grupa.innerHTML = `<h3>${T.grupa_naslov} · ${osobeTekst(osoba)}</h3>` + (k.length
    ? `<p class="mala">${T.grupa_tekst}</p>` + k.map((x, i) => `<div class="komb">
        <div><div class="komb-ap">${x.apartmani.map((a) => `<a href="${esc(uUrl(a.url, o))}">${esc(a.naziv.replace(/^Apartment /, ''))}</a>`).join(' + ')}</div>
        <div class="mala">${T.do_osoba_s.replace('%s', osobeTekst(x.mjesta))}${x.ukupno != null ? ` · ${nociTekst(x.noci)} · ${T.okvirno} <b>${eur(x.ukupno)}</b>` : ''}</div></div>
        <button type="button" class="gumb" data-komb="${i}">${T.grupa_upit}</button></div>`).join('')
    : `<p>${T.grupa_nema}</p><div><a class="gumb" href="#upit">${T.posalji}</a></div>`);
  grupa.hidden = false;
  grupa.querySelectorAll('[data-komb]').forEach((b) => (b.onclick = () => posaljiUUpit(k[+b.dataset.komb].apartmani.map((a) => a.oznaka))));
}

/** Prenese odabir u obrazac za upit na dnu stranice i skrolne do njega. */
function posaljiUUpit(oznake) {
  if (!upit) return;
  upit.dispatchEvent(new CustomEvent('odaberi', { detail: { ...odabir(), apartmani: oznake } }));
  document.getElementById('upit').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
document.querySelector('[data-cijela-kuca]')?.addEventListener('click', (e) => {
  e.preventDefault();
  const o = odabir();
  posaljiUUpit(APS.map((a) => a.oznaka));
  if (!o.od) upit?.querySelector('[name=od]')?.focus({ preventScroll: true });
});

forma.addEventListener('submit', (e) => {
  e.preventDefault();
  const o = odabir();
  history.replaceState(null, '', uUrl(location.pathname, o) + '#apartmani');
  osvjezi();
  document.getElementById('apartmani').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  // i u obrazac za upit na dnu stranice
  if (upit && o.od) upit.dispatchEvent(new CustomEvent('odaberi', { detail: o }));
});
forma.addEventListener('change', () => { if (polje('od').value && polje('do').value) osvjezi(); });
osvjezi();
