// Obrazac za upit: jedan ili više apartmana (ili cijela kuća), popunjavanje iz poveznice, okvirni iznos, slanje na /api/upit.php.
import { izracun, izracunVise } from './cijene.js';
import { T, podaci, eur, nociTekst, izUrla, veziDatume, postaviWhatsApp } from './zajednicko.js';

for (const f of document.querySelectorAll('form.obrazac-upita')) {
  const p = (n) => f.querySelector(`[name=${n}]`);
  const stanje = f.querySelector('[data-stanje]'), iznosEl = f.querySelector('[data-iznos]'), krevetic = f.querySelector('[data-krevetic]');
  const polje = f.querySelector('[data-apartmani]'), sve = f.querySelector('[data-sve]');
  const kvacice = [...f.querySelectorAll('input[name=apartman]')];
  const gumb = f.querySelector('button[type=submit]');
  const otvoreno = Date.now();

  const odabrani = () => kvacice.filter((x) => x.checked);
  const uskladiSve = () => { sve.checked = kvacice.every((x) => x.checked); };
  const odaberi = (oznake) => { kvacice.forEach((x) => (x.checked = oznake.includes(x.value))); uskladiSve(); };

  const u = izUrla();
  if (u.od) p('od').value = u.od;
  if (u.do) p('do').value = u.do;
  if (u.apartman) odaberi(u.apartman === 'sve' ? kvacice.map((x) => x.value) : u.apartman.split(','));
  for (const n of ['odrasli', 'djeca', 'bebe']) if (p(n).querySelector(`option[value="${u[n]}"]`)) p(n).value = u[n];
  veziDatume(p('od'), p('do'));
  uskladiSve();
  sve.addEventListener('change', () => kvacice.forEach((x) => (x.checked = sve.checked)));
  kvacice.forEach((x) => x.addEventListener('change', uskladiSve));

  // Naslovnica šalje odabir (kombinacija za grupu, cijela kuća, gosti).
  f.addEventListener('odaberi', (e) => {
    const d = e.detail || {};
    if (d.apartmani) odaberi(d.apartmani);
    for (const n of ['od', 'do']) if (d[n]) p(n).value = d[n];
    for (const n of ['odrasli', 'djeca', 'bebe']) if (d[n] != null && p(n).querySelector(`option[value="${d[n]}"]`)) p(n).value = d[n];
    osvjezi();
  });

  const nazivi = () => (sve.checked ? T.cijela_kuca : odabrani().map((x) => x.dataset.naziv).join(', '));

  async function osvjezi() {
    krevetic.hidden = !(+p('bebe').value > 0);
    if (krevetic.hidden) p('krevetic').checked = false;
    postaviWhatsApp(nazivi(), p('od').value, p('do').value);
    iznosEl.hidden = true;
    iznosEl.dataset.vrijednost = '';
    const izbor = odabrani();
    if (!izbor.length || !p('od').value || !(p('do').value > p('od').value)) return;
    const P = await podaci();
    const aps = izbor.map((x) => ({ oznaka: x.value, naziv: x.dataset.naziv, maxOsoba: +x.dataset.max, ...P?.apartmani?.[x.value] }));
    if (aps.some((a) => !a.cjenik)) return;
    const gosti = { odrasli: +p('odrasli').value, djeca: +p('djeca').value };
    const r = aps.length === 1 ? izracun(aps[0], p('od').value, p('do').value, gosti) : izracunVise(aps, p('od').value, p('do').value, gosti);
    if (r.greska === 'kapacitet') iznosEl.textContent = aps.length === 1 ? T.greska_kapacitet : T.greska_kapacitet_vise;
    else if (r.greska === 'zauzeto') iznosEl.textContent = aps.length === 1 ? T.termin_zauzet
      : T.termin_zauzet_vise.replace('%s', aps.filter((a) => r.zauzeti.includes(a.oznaka)).map((a) => a.naziv).join(', '));
    else if (r.ukupno != null) {
      iznosEl.textContent = `${nociTekst(r.noci)} · ${T.okvirno} ${eur(r.ukupno)}`;
      iznosEl.dataset.vrijednost = String(r.ukupno);
    } else return;
    iznosEl.hidden = false;
  }
  f.addEventListener('change', osvjezi);
  f.addEventListener('osvjezi', osvjezi);
  osvjezi();

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    f.querySelectorAll('[data-greska]').forEach((x) => x.removeAttribute('data-greska'));
    stanje.innerHTML = '';
    const greske = [];
    if (!(p('do').value > p('od').value)) greske.push('datumi');
    if (p('ime').value.trim().length < 2) greske.push('ime');
    if (!p('email').checkValidity() || !p('email').value) greske.push('email');
    if (greske.length) return pokaziGreske(greske, greske.includes('datumi') ? T.greska_datumi : T.greska_polja);

    const tijelo = {
      jezik: f.dataset.jezik, apartmani: odabrani().map((x) => x.value), od: p('od').value, do: p('do').value,
      odrasli: +p('odrasli').value, djeca: +p('djeca').value, bebe: +p('bebe').value, krevetic: p('krevetic').checked,
      ime: p('ime').value, email: p('email').value, telefon: p('telefon').value, poruka: p('poruka').value,
      web: p('web').value, trajanje: Date.now() - otvoreno, iznos: iznosEl.dataset.vrijednost || '',
    };
    gumb.disabled = true;
    gumb.textContent = T.saljem;
    try {
      const r = await fetch('/api/upit.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tijelo) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) {
        stanje.innerHTML = `<p class="poruka-ok">${T.upit_poslan}</p>`;
        for (const n of ['ime', 'email', 'telefon', 'poruka']) p(n).value = '';
      } else if (d.greska === 'polja') pokaziGreske(d.polja || [], d.polja?.includes('kapacitet') ? (tijelo.apartmani.length > 1 ? T.greska_kapacitet_vise : T.greska_kapacitet) : T.greska_polja);
      else stanje.innerHTML = `<p class="poruka-greska">${{ prebrzo: T.greska_prebrzo, previse: T.greska_previse }[d.greska] || T.greska_slanje}</p>`;
    } catch {
      stanje.innerHTML = `<p class="poruka-greska">${T.greska_slanje}</p>`;
    } finally {
      gumb.disabled = false;
      gumb.textContent = T.posalji;
    }
    stanje.scrollIntoView({ block: 'nearest' });
  });

  function pokaziGreske(polja, tekst) {
    const mapa = { datumi: ['od', 'do'], ime: ['ime'], email: ['email'], odrasli: ['odrasli'], kapacitet: ['odrasli', 'djeca'] };
    polja.flatMap((x) => mapa[x] || []).forEach((n) => p(n).closest('.polje')?.setAttribute('data-greska', ''));
    if (polja.includes('apartman') || polja.includes('kapacitet')) polje.setAttribute('data-greska', '');
    stanje.innerHTML = `<p class="poruka-greska">${tekst}</p>`;
    f.querySelector('[data-greska] input, [data-greska] select')?.focus();
  }
}
