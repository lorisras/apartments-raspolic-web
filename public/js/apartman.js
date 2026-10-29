// Stranica apartmana: kalendar zauzetosti s cijenama po danu, odabir datuma i gostiju, izračun, tablica cijena, galerija.
import { cijenaDana, zauzetDan, slobodno, izracun, najnizaCijena, dodajDane, danas } from './cijene.js';
import { T, podaci, eur, nociTekst, datumTekst, izUrla, uUrl, postaviWhatsApp } from './zajednicko.js';

const AP = JSON.parse(document.getElementById('apartman-podaci').textContent);
const el = {
  kal: document.getElementById('kalendar'),
  gosti: document.getElementById('kal-gosti'),
  uputa: document.querySelector('[data-uputa]'),
  zbroj: document.querySelector('[data-zbroj]'),
  posalji: document.querySelector('[data-posalji]'),
  odCijena: document.querySelector('[data-od-cijena]'),
  cjenik: document.getElementById('cjenik'),
};
const DANAS = danas();
const MAX_MJESECI = 18;
const pocetno = izUrla();
const S = { od: pocetno.od >= DANAS ? pocetno.od : '', do: '', mjesec: (pocetno.od >= DANAS ? pocetno.od : DANAS).slice(0, 7), p: { zauzeto: [], cjenik: {} } };
if (S.od && pocetno.do > S.od) S.do = pocetno.do;
for (const n of ['odrasli', 'djeca', 'bebe']) {
  const s = el.gosti.querySelector(`[name=${n}]`);
  if (s?.querySelector(`option[value="${pocetno[n]}"]`)) s.value = pocetno[n];
}
const gosti = () => Object.fromEntries(['odrasli', 'djeca', 'bebe'].map((n) => [n, +el.gosti.querySelector(`[name=${n}]`).value]));

// ------------------------------------------------------------- kalendar
const mjesecPlus = (m, n) => { const [g, mm] = m.split('-').map(Number); const d = new Date(Date.UTC(g, mm - 1 + n, 1)); return d.toISOString().slice(0, 7); };
const imenaDana = () => { const f = new Intl.DateTimeFormat(T.lokal, { weekday: 'short' }); return [...Array(7)].map((_, i) => f.format(new Date(Date.UTC(2024, 0, 1 + i)))); }; // 1.1.2024. je ponedjeljak

function crtajKalendar() {
  const [g, m] = S.mjesec.split('-').map(Number);
  const prvi = `${S.mjesec}-01`, brojDana = new Date(Date.UTC(g, m, 0)).getUTCDate();
  const pomak = (new Date(prvi + 'T12:00:00Z').getUTCDay() + 6) % 7;
  const zadnjiMj = mjesecPlus(DANAS.slice(0, 7), MAX_MJESECI);
  const biramOdlazak = S.od && !S.do;
  const naslov = new Date(prvi + 'T12:00:00').toLocaleDateString(T.lokal, { month: 'long', year: 'numeric' });
  let html = `<div class="kal-glava"><button type="button" data-mj="-1" aria-label="${T.pret_mj}" ${S.mjesec <= DANAS.slice(0, 7) ? 'disabled' : ''}>‹</button><b>${naslov}</b><button type="button" data-mj="1" aria-label="${T.sljed_mj}" ${S.mjesec >= zadnjiMj ? 'disabled' : ''}>›</button></div><div class="kal-mreza">`;
  html += imenaDana().map((d) => `<span class="kal-dan-ime">${d}</span>`).join('');
  html += '<span></span>'.repeat(pomak);
  for (let i = 1; i <= brojDana; i++) {
    const d = `${S.mjesec}-${String(i).padStart(2, '0')}`;
    const proslo = d < DANAS, zauz = zauzetDan(S.p.zauzeto, d);
    const moguciOdlazak = biramOdlazak && d > S.od && slobodno(S.p.zauzeto, S.od, d);
    const c = !proslo && !zauz ? cijenaDana(S.p.cjenik, d) : null;
    const kl = ['kal-dan', proslo && 'proslo', zauz && 'zauzet', moguciOdlazak && 'odlazak-moguc',
      (d === S.od || d === S.do) && 'odabran', S.od && S.do && d > S.od && d < S.do && 'u-rasponu'].filter(Boolean).join(' ');
    const omoguceno = !proslo && (biramOdlazak ? moguciOdlazak || (!zauz && d <= S.od) : !zauz);
    html += `<button type="button" class="${kl}" data-d="${d}" ${omoguceno ? '' : 'disabled'} aria-pressed="${d === S.od || d === S.do}" aria-label="${datumTekst(d, { day: 'numeric', month: 'long' })}${zauz ? ' – ' + T.zauzeto : c != null ? ' – ' + eur(c) : ''}">${i}${c != null ? `<small>${Math.round(c)}</small>` : '<small>&nbsp;</small>'}</button>`;
  }
  html += `</div><div class="kal-legenda"><span><i></i>${T.slobodno}</span><span><i class="z"></i>${T.zauzeto}</span><span>85 = € ${T.po_noci}</span></div>`;
  el.kal.innerHTML = html;
}

el.kal.addEventListener('click', (e) => {
  const mj = e.target.closest('[data-mj]');
  if (mj) { S.mjesec = mjesecPlus(S.mjesec, +mj.dataset.mj); crtajKalendar(); return; }
  const b = e.target.closest('[data-d]');
  if (!b || b.disabled) return;
  const d = b.dataset.d;
  if (!S.od || S.do || d <= S.od) { S.od = d; S.do = ''; }
  else S.do = d;
  osvjezi();
});

// ------------------------------------------------------------- izračun i poveznice
function osvjezi() {
  crtajKalendar();
  const g = gosti();
  const o = { apartman: AP.oznaka, od: S.od, do: S.do, ...g };
  el.posalji.href = uUrl(AP.upit, o);
  postaviWhatsApp(AP.naziv, S.od, S.do);
  if (S.od && S.do) history.replaceState(null, '', uUrl(location.pathname, { od: S.od, do: S.do, ...g }));
  if (!S.od) { el.uputa.textContent = T.odaberi_dolazak; el.uputa.hidden = false; el.zbroj.hidden = true; return; }
  if (!S.do) { el.uputa.textContent = T.odaberi_odlazak; el.uputa.hidden = false; el.zbroj.hidden = true; return; }
  el.uputa.hidden = true;
  const r = izracun({ maxOsoba: AP.maxOsoba, zauzeto: S.p.zauzeto, cjenik: S.p.cjenik }, S.od, S.do, g);
  let html = `<div>${datumTekst(S.od)} – ${datumTekst(S.do)} · ${nociTekst(r.noci)}</div>`;
  if (r.greska === 'zauzeto') html += `<div class="upozorenje">${T.termin_zauzet}</div>`;
  else if (r.greska === 'kapacitet') html += `<div class="upozorenje">${T.greska_kapacitet}</div>`;
  else if (r.ukupno == null) html += `<div>${T.na_upit}</div>`;
  else {
    html += `<div class="ukupno"><span>${T.okvirno} ${T.ukupno}</span><span>${eur(r.ukupno)}</span></div>`;
    if (r.greska === 'minNoci') html += `<div class="upozorenje">${T.minNoci.replace('%n', r.minNoci)}</div>`;
  }
  el.zbroj.innerHTML = html;
  el.zbroj.hidden = false;
}
el.gosti.addEventListener('change', osvjezi);

// ------------------------------------------------------------- tablica cijena
function crtajCjenik() {
  const cj = S.p.cjenik || {}, N = JSON.parse(el.cjenik.dataset.naslovi);
  const md = (x) => { const [m, d] = x.split('-'); return `${+d}. ${+m}.`; };
  const godine = Object.keys(cj.godine || {}).filter((g) => +g >= +DANAS.slice(0, 4)).sort();
  if (!godine.length) { el.cjenik.innerHTML = `<p class="tekst-2">${T.na_upit}</p>`; return; }
  el.cjenik.innerHTML = godine.map((g) => {
    const y = cj.godine[g], min = (x) => x || y.minNoci || cj.minNoci || 1;
    const red = (r, c, m) => `<tr><td>${r}</td><td class="c">${c == null ? '—' : eur(c)}</td><td>${m}</td></tr>`;
    const redovi = (y.sezone || []).map((s) => red(`${md(s.od)} – ${md(s.do)}`, s.cijena, min(s.minNoci))).join('')
      + red(y.sezone?.length ? N.ostalo : N.cijelaGodina, y.cijena, min());
    return `<div class="cjenik-omot"><table class="cjenik-tablica"><caption>${g}.</caption><thead><tr><th>${N.razdoblje}</th><th>${N.cijena}</th><th>${N.min}</th></tr></thead><tbody>${redovi}</tbody></table></div>`;
  }).join('');
  const d = cj.dodatak;
  if (d && +d.vrijednost > 0 && (cj.osnovnaZa || AP.maxOsoba) < AP.maxOsoba) {
    const p = document.createElement('p');
    p.className = 'tekst-2';
    p.textContent = el.cjenik.dataset.dodatak.replace('%o', cj.osnovnaZa).replace('%d', d.tip === 'postotak' ? `${d.vrijednost} %` : eur(d.vrijednost));
    el.cjenik.append(p);
  }
}

// ------------------------------------------------------------- galerija
const dlg = document.getElementById('pregled');
document.querySelectorAll('[data-otvori]').forEach((b) => b.addEventListener('click', () => {
  if (!dlg) return;
  dlg.showModal();
  document.getElementById(`f${b.dataset.otvori}`)?.scrollIntoView({ block: 'start' });
}));
dlg?.querySelector('[data-zatvori]').addEventListener('click', () => dlg.close());
dlg?.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

// ------------------------------------------------------------- start
osvjezi();
podaci().then((P) => {
  S.p = P?.apartmani?.[AP.oznaka] || S.p;
  const min = najnizaCijena(S.p.cjenik, DANAS);
  el.odCijena.innerHTML = min == null ? T.na_upit : `${T.od_cijena} <b>${eur(min)}</b> ${T.po_noci}`;
  crtajCjenik();
  osvjezi();
});
