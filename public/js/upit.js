// Obrazac za upit: popunjavanje iz poveznice, okvirni iznos, slanje na /api/upit.php.
import { izracun } from './cijene.js';
import { T, podaci, eur, nociTekst, izUrla, veziDatume, postaviWhatsApp } from './zajednicko.js';

for (const f of document.querySelectorAll('form.obrazac-upita')) {
  const p = (n) => f.querySelector(`[name=${n}]`);
  const stanje = f.querySelector('[data-stanje]'), iznosEl = f.querySelector('[data-iznos]'), krevetic = f.querySelector('[data-krevetic]');
  const gumb = f.querySelector('button[type=submit]');
  const otvoreno = Date.now();

  const u = izUrla();
  if (u.od) p('od').value = u.od;
  if (u.do) p('do').value = u.do;
  if (u.apartman && p('apartman').querySelector(`option[value="${CSS.escape(u.apartman)}"]`)) p('apartman').value = u.apartman;
  for (const n of ['odrasli', 'djeca', 'bebe']) if (p(n).querySelector(`option[value="${u[n]}"]`)) p(n).value = u[n];
  veziDatume(p('od'), p('do'));

  const nazivAp = () => (p('apartman').value ? p('apartman').selectedOptions[0].textContent : '');
  async function osvjezi() {
    krevetic.hidden = !(+p('bebe').value > 0);
    if (krevetic.hidden) p('krevetic').checked = false;
    postaviWhatsApp(nazivAp(), p('od').value, p('do').value);
    iznosEl.hidden = true;
    iznosEl.dataset.vrijednost = '';
    const o = p('apartman').value;
    if (!o || !p('od').value || !(p('do').value > p('od').value)) return;
    const P = await podaci(), ap = P?.apartmani?.[o];
    if (!ap) return;
    const max = +p('apartman').selectedOptions[0].dataset.max;
    const r = izracun({ maxOsoba: max, zauzeto: ap.zauzeto, cjenik: ap.cjenik }, p('od').value, p('do').value, { odrasli: +p('odrasli').value, djeca: +p('djeca').value });
    if (r.greska === 'kapacitet') iznosEl.textContent = T.greska_kapacitet;
    else if (r.greska === 'zauzeto') iznosEl.textContent = T.termin_zauzet;
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
      jezik: f.dataset.jezik, apartman: p('apartman').value, od: p('od').value, do: p('do').value,
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
      } else if (d.greska === 'polja') pokaziGreske(d.polja || [], d.polja?.includes('kapacitet') ? T.greska_kapacitet : T.greska_polja);
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
    const mapa = { datumi: ['od', 'do'], ime: ['ime'], email: ['email'], odrasli: ['odrasli'], apartman: ['apartman'], kapacitet: ['odrasli', 'djeca', 'apartman'] };
    polja.flatMap((x) => mapa[x] || []).forEach((n) => p(n).closest('.polje')?.setAttribute('data-greska', ''));
    stanje.innerHTML = `<p class="poruka-greska">${tekst}</p>`;
    f.querySelector('[data-greska] input, [data-greska] select')?.focus();
  }
}
