// Admin weba Apartments Rašpolić: cijene po danima, osnovne cijene, zatvaranja, iCal poveznice.
import { cijenaDana, zauzetDan, dodajDane, danas } from '../js/cijene.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const CSRF = $('meta[name=csrf]').content;
const MJ = ['siječanj', 'veljača', 'ožujak', 'travanj', 'svibanj', 'lipanj', 'srpanj', 'kolovoz', 'rujan', 'listopad', 'studeni', 'prosinac'];
const DAN = ['ne', 'po', 'ut', 'sr', 'če', 'pe', 'su'];
const fd = (d) => (d ? `${+d.slice(8)}.${+d.slice(5, 7)}.${d.slice(0, 4)}.` : '');
const eur = (n) => (n == null ? '—' : `${Number(n).toLocaleString('hr-HR', { maximumFractionDigits: 2 })} €`);
// Osnovna cijena vrijedi za toliko osoba (dogovor 29.10.2026.); ostalo = najveći broj osoba.
const ZADANO_OSNOVNA_ZA = { 'no-1': 2, 'no-3': 4, 'no-5': 4 };

const S = { podaci: null, kartica: 'cijene', mjesec: danas().slice(0, 7), odabir: { od: '', do: '', aps: new Set(), sidro: null } };

function poruka(t) {
  const p = $('#poruka');
  p.textContent = t;
  p.hidden = false;
  clearTimeout(poruka.t);
  poruka.t = setTimeout(() => (p.hidden = true), 3500);
}

async function api(op, tijelo) {
  const r = await fetch(`api.php?op=${op}`, tijelo === undefined ? {} : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF': CSRF },
    body: JSON.stringify(tijelo),
  });
  if (r.status === 401) { location.reload(); throw new Error('prijava'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { poruka(d.poruka || 'Spremanje nije uspjelo.'); throw new Error(d.greska || r.status); }
  if (d.apartmani) S.podaci = { ...S.podaci, ...d };
  return d;
}

const aps = () => S.podaci.apartmani;
const cjenik = (o) => S.podaci.cijene.apartmani?.[o] || {};
const zauzeto = (o) => S.podaci.dostupnost.apartmani?.[o] || [];
const naziv = (o) => aps().find((a) => a.oznaka === o)?.naziv || o;

function cipoviApartmana(odabrani, ime) {
  const vlasnici = [...new Set(aps().map((a) => a.vlasnik))];
  return `<div class="cipovi">${aps().map((a) => `<label><input type="checkbox" name="${ime}" value="${esc(a.oznaka)}" ${odabrani.has(a.oznaka) ? 'checked' : ''}>${esc(a.naziv)}</label>`).join('')}</div>
    <div class="red"><button type="button" class="poveznica" data-sve="${ime}">svi</button>${vlasnici.map((v) => `<button type="button" class="poveznica" data-vl="${esc(v)}" data-ime="${ime}">${esc(v.split(' ')[0])}</button>`).join('')}<button type="button" class="poveznica" data-nista="${ime}">nijedan</button></div>`;
}
function veziCipove(korijen, ime, set, nakon) {
  $$(`input[name=${ime}]`, korijen).forEach((x) => (x.onchange = () => { x.checked ? set.add(x.value) : set.delete(x.value); nakon?.(); }));
  const postavi = (lista) => { set.clear(); lista.forEach((o) => set.add(o)); $$(`input[name=${ime}]`, korijen).forEach((x) => (x.checked = set.has(x.value))); nakon?.(); };
  $$(`[data-sve=${ime}]`, korijen).forEach((b) => (b.onclick = () => postavi(aps().map((a) => a.oznaka))));
  $$(`[data-nista=${ime}]`, korijen).forEach((b) => (b.onclick = () => postavi([])));
  $$(`[data-ime=${ime}]`, korijen).forEach((b) => (b.onclick = () => postavi(aps().filter((a) => a.vlasnik === b.dataset.vl).map((a) => a.oznaka))));
}

// ---------------------------------------------------------------- Cijene po danima
function karticaCijene() {
  const O = S.odabir, kan = S.podaci.postavke.kanali || {};
  const [g, m] = S.mjesec.split('-').map(Number);
  const brojDana = new Date(g, m, 0).getDate();
  const dani = Array.from({ length: brojDana }, (_, i) => `${S.mjesec}-${String(i + 1).padStart(2, '0')}`);
  const vik = (d) => [0, 6].includes(new Date(d + 'T12:00:00').getDay());
  const red = (a) => {
    const cj = cjenik(a.oznaka);
    return `<tr><th class="ime" scope="row">${esc(a.naziv)}</th>${dani.map((d) => {
      const c = cijenaDana(cj, d), kl = [vik(d) && 'vik', cj.dani?.[d] != null && 'rucno', zauzetDan(zauzeto(a.oznaka), d) && 'zauzeto', c == null && 'prazan',
        O.aps.has(a.oznaka) && O.od && d >= O.od && d <= (O.do || O.od) && 'odabran'].filter(Boolean).join(' ');
      return `<td class="${kl}" data-ap="${esc(a.oznaka)}" data-d="${d}" title="${esc(a.naziv)} · ${fd(d)}">${c == null ? '·' : Math.round(c)}</td>`;
    }).join('')}</tr>`;
  };
  return `<section class="kartica">
    <h2>Cijene po danima</h2>
    <p class="mala">Kliknite dan u tablici za početak, pa drugi dan u istom redu za kraj raspona. Možete označiti i više apartmana. Cijena vrijedi za osnovni broj osoba; dodatak za dodatne osobe postavlja se u „Osnovne cijene“.</p>
    ${cipoviApartmana(O.aps, 'dani-ap')}
    <div class="mreza">
      <label>Od (prva noć)<input type="date" id="d-od" value="${O.od}"></label>
      <label>Do (zadnja noć)<input type="date" id="d-do" value="${O.do || O.od}"></label>
      <label>Što napraviti<select id="d-akcija">
        <option value="postavi">Postavi cijenu</option>
        <option value="postotak">Promijeni za % (npr. -10)</option>
        <option value="iznos">Promijeni za € (npr. -5)</option>
        <option value="obrisi">Vrati na osnovnu / sezonsku</option>
      </select></label>
      <label id="d-v-l">Cijena €<input id="d-v" inputmode="decimal" autocomplete="off"></label>
      <button type="button" class="gumb glavni" id="d-spremi">Spremi</button>
    </div>
    <p class="kanali" id="d-kanali"></p>
  </section>
  <section class="kartica">
    <div class="red sredina"><button type="button" class="gumb" id="m-pret" aria-label="Prethodni mjesec">‹</button><h3 id="m-naziv">${MJ[m - 1]} ${g}.</h3><button type="button" class="gumb" id="m-sljed" aria-label="Sljedeći mjesec">›</button><button type="button" class="gumb" id="m-danas">Danas</button></div>
    <div class="omot"><table class="dani"><thead><tr><th class="ime">Apartman</th>${dani.map((d) => `<th class="${vik(d) ? 'vik' : ''}">${+d.slice(8)}<br>${DAN[new Date(d + 'T12:00:00').getDay()]}</th>`).join('')}</tr></thead><tbody>${aps().map(red).join('')}</tbody></table></div>
    <div class="legenda"><span><i class="lg-r"></i>ružičasto = ručno postavljena cijena</span><span>sivo = zauzeto (Booking, Airbnb ili zatvoreno)</span><span>· = nema cijene</span><span>Booking ${kan.booking >= 0 ? '+' : ''}${kan.booking || 0} %, Airbnb ${kan.airbnb >= 0 ? '+' : ''}${kan.airbnb || 0} % (Kalendari)</span></div>
  </section>`;
}
function veziCijene(el) {
  const O = S.odabir;
  const kanali = () => {
    const ak = $('#d-akcija').value, v = parseFloat(($('#d-v').value || '').replace(',', '.'));
    $('#d-v-l').hidden = ak === 'obrisi';
    $('#d-v-l').firstChild.textContent = { postavi: 'Cijena €', postotak: 'Promjena %', iznos: 'Promjena €' }[ak] || '';
    const k = S.podaci.postavke.kanali || {};
    $('#d-kanali').innerHTML = ak === 'postavi' && v > 0
      ? `Za ručni upis: Booking <b>${eur(Math.round(v * (1 + (k.booking || 0) / 100)))}</b> · Airbnb <b>${eur(Math.round(v * (1 + (k.airbnb || 0) / 100)))}</b>`
      : '';
  };
  veziCipove(el, 'dani-ap', O.aps, () => render());
  $('#d-akcija').onchange = kanali;
  $('#d-v').oninput = kanali;
  kanali();
  $('#d-od').onchange = (e) => { O.od = e.target.value; if (!O.do || O.do < O.od) O.do = O.od; render(); };
  $('#d-do').onchange = (e) => { O.do = e.target.value; render(); };
  const mj = (n) => { const [g, m] = S.mjesec.split('-').map(Number); const d = new Date(g, m - 1 + n, 1); S.mjesec = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; render(); };
  $('#m-pret').onclick = () => mj(-1);
  $('#m-sljed').onclick = () => mj(1);
  $('#m-danas').onclick = () => { S.mjesec = danas().slice(0, 7); render(); };
  $$('table.dani td', el).forEach((td) => (td.onclick = () => {
    const ap = td.dataset.ap, d = td.dataset.d;
    if (O.sidro && O.sidro.ap === ap && d >= O.sidro.d && !O.zatvoren) { O.do = d; O.zatvoren = true; }
    else { O.sidro = { ap, d }; O.od = d; O.do = d; O.zatvoren = false; O.aps.add(ap); }
    render();
  }));
  $('#d-spremi').onclick = async (e) => {
    const ak = $('#d-akcija').value, v = parseFloat(($('#d-v').value || '').replace(',', '.'));
    if (!O.aps.size) return poruka('Odaberite barem jedan apartman.');
    if (!O.od) return poruka('Odaberite datume.');
    if (ak !== 'obrisi' && !Number.isFinite(v)) return poruka('Upišite iznos.');
    e.target.disabled = true;
    try {
      const r = await api('dani', { apartmani: [...O.aps], od: O.od, do: O.do || O.od, akcija: ak, vrijednost: v });
      poruka(r.bezCijene?.length ? `Spremljeno. Bez osnovne cijene (preskočeno): ${r.bezCijene.map(naziv).join(', ')}` : 'Cijene spremljene');
      render();
    } finally { e.target.disabled = false; }
  };
}

// ---------------------------------------------------------------- Osnovne cijene
// Razdoblja (npr. 1.6.–30.9.) su zajednička za sve apartmane; cijene se upisuju u tablicu apartmani × razdoblja.
// Na web se spremaju kao sezone svakog apartmana, pa izračun (cijene.js, lib.php) ostaje isti.
// Cjenik iz aplikacije Računi (po noćenju, cijela godina) – polazište za gumb „Popuni iz Računa“.
const CJENIK_RACUNI = {
  2026: { studio: 60, 'studio-loft': 60, 'no-1': 80, 'no-2': 100, 'no-4': 100, 'no-3': 120, 'no-5': 120 },
  2027: { studio: 80, 'studio-loft': 80, 'no-1': 100, 'no-2': 120, 'no-4': 120, 'no-3': 140, 'no-5': 140 },
};
const md = (v) => (v ? `${+v.slice(3)}.${+v.slice(0, 2)}.` : '');
const mmdd = (v) => {
  const m = String(v).trim().match(/^(\d{1,2})\.\s*(\d{1,2})\.?$/);
  if (!m || +m[2] < 1 || +m[2] > 12 || +m[1] < 1 || +m[1] > new Date(2024, +m[2], 0).getDate()) return null;
  return `${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
};
const broj = (v) => (String(v ?? '').trim() === '' ? null : parseFloat(String(v).replace(',', '.')));
let NACRT = null;   // nespremljene promjene na kartici Osnovne cijene

function nacrtIzPodataka() {
  const c = S.podaci.cijene || {}, g0 = new Date().getFullYear();
  const D = { aps: {}, godine: {} };
  for (const a of aps()) {
    const cj = cjenik(a.oznaka);
    D.aps[a.oznaka] = { osnovnaZa: String(cj.osnovnaZa || ZADANO_OSNOVNA_ZA[a.oznaka] || a.maxOsoba), tip: cj.dodatak?.tip || 'iznos', vrijednost: String(cj.dodatak?.vrijednost || ''), minNoci: String(cj.minNoci || 1) };
  }
  const godine = new Set([g0, g0 + 1]);
  for (const a of aps()) Object.keys(cjenik(a.oznaka).godine || {}).forEach((g) => +g >= g0 && godine.add(+g));
  Object.keys(c.razdoblja || {}).forEach((g) => +g >= g0 && godine.add(+g));
  for (const g of [...godine].sort()) {
    let raz = c.razdoblja?.[g];
    if (!raz) {                                   // stari zapis: razdoblja iz sezona pojedinih apartmana
      const m = new Map();
      for (const a of aps()) for (const s of cjenik(a.oznaka).godine?.[g]?.sezone || []) if (!m.has(s.od + s.do)) m.set(s.od + s.do, { od: s.od, do: s.do, minNoci: s.minNoci });
      raz = [...m.values()].sort((x, y) => x.od.localeCompare(y.od));
    }
    const y = (o) => cjenik(o).godine?.[g] || {};
    D.godine[g] = {
      minNoci: String(aps().map((a) => y(a.oznaka).minNoci).find(Boolean) || ''),
      razdoblja: raz.map((r) => ({ od: md(r.od), do: md(r.do), minNoci: String(r.minNoci || '') })),
      cijene: Object.fromEntries(aps().map((a) => [a.oznaka, {
        osnovna: String(y(a.oznaka).cijena ?? ''),
        r: raz.map((r) => String((y(a.oznaka).sezone || []).find((s) => s.od === r.od && s.do === r.do)?.cijena ?? '')),
      }])),
    };
  }
  return D;
}

function karticaOsnovno() {
  const D = (NACRT ||= nacrtIzPodataka());
  const ul = (put, v, extra = '') => `<input data-p="${esc(put)}" value="${esc(v)}" autocomplete="off" ${extra}>`;
  const osobe = (n) => `${n} ${n === 1 ? 'osobu' : n < 5 ? 'osobe' : 'osoba'}`;
  return `<section class="kartica">
    <h2>Osnovne cijene</h2>
    <p class="mala">Web ove cijene uzima automatski za svaki dan. Pojedine dane mijenjate u „Cijene po danima“ (tamo su ružičasti), a „Vrati na osnovnu“ ih vraća na ove. Razdoblja su zajednička za sve apartmane. Prazno polje u razdoblju znači da vrijedi osnovna cijena godine.</p>
    <h3>Osobe, dodatak i najmanje noći</h3>
    <div class="omot"><table class="osn">
      <thead><tr><th>Apartman</th><th>Cijena vrijedi za</th><th>Dodatak za svaku sljedeću osobu</th><th>Min. noći</th></tr></thead>
      <tbody>${aps().map((a) => { const x = D.aps[a.oznaka]; return `<tr><th scope="row">${esc(a.naziv)}<span class="mala"> do ${a.maxOsoba}</span></th>
        <td><select data-p="aps.${a.oznaka}.osnovnaZa">${Array.from({ length: a.maxOsoba }, (_, i) => i + 1).map((n) => `<option value="${n}" ${String(n) === x.osnovnaZa ? 'selected' : ''}>${osobe(n)}</option>`).join('')}</select></td>
        <td data-dodatak="${a.maxOsoba}"><span class="mala" ${+x.osnovnaZa >= a.maxOsoba ? '' : 'hidden'}>— (ista cijena za sve)</span><div class="dvoje" ${+x.osnovnaZa >= a.maxOsoba ? 'hidden' : ''}>${ul(`aps.${a.oznaka}.vrijednost`, x.vrijednost, 'inputmode="decimal" placeholder="0"')}<select data-p="aps.${a.oznaka}.tip"><option value="iznos" ${x.tip !== 'postotak' ? 'selected' : ''}>€ po noći</option><option value="postotak" ${x.tip === 'postotak' ? 'selected' : ''}>% cijene noći</option></select></div></td>
        <td>${ul(`aps.${a.oznaka}.minNoci`, x.minNoci, 'inputmode="numeric" class="usko"')}</td></tr>`; }).join('')}</tbody>
    </table></div>
  </section>
  ${Object.entries(D.godine).map(([g, y]) => `<section class="kartica">
    <h2>${g}.</h2>
    <h3>Razdoblja</h3>
    ${y.razdoblja.length ? `<div class="razdoblja">${y.razdoblja.map((r, i) => `<div class="razdoblje">
      <label>Od (dd.mm.)${ul(`godine.${g}.razdoblja.${i}.od`, r.od, 'placeholder="1.6."')}</label>
      <label>Do, zadnja noć${ul(`godine.${g}.razdoblja.${i}.do`, r.do, 'placeholder="30.9."')}</label>
      <label>Min. noći${ul(`godine.${g}.razdoblja.${i}.minNoci`, r.minNoci, 'inputmode="numeric" placeholder="—"')}</label>
      <button type="button" class="x" data-ukloni="${g}|${i}" aria-label="Ukloni razdoblje">×</button></div>`).join('')}</div>`
      : '<p class="mala">Nema razdoblja: cijela godina ima osnovnu cijenu.</p>'}
    <div><button type="button" class="gumb" data-dodaj="${g}">+ Razdoblje</button></div>
    <h3>Cijene po noći (€)</h3>
    <div class="omot"><table class="osn">
      <thead><tr><th>Apartman</th><th>Osnovna<br><span class="mala">${y.razdoblja.length ? 'ostali dani' : 'cijela godina'}</span></th>${y.razdoblja.map((r, i) => `<th data-th="${g}|${i}">${esc(r.od || '?')}–${esc(r.do || '?')}</th>`).join('')}</tr></thead>
      <tbody>${aps().map((a) => { const x = y.cijene[a.oznaka]; return `<tr><th scope="row">${esc(a.naziv)}</th>
        <td>${ul(`godine.${g}.cijene.${a.oznaka}.osnovna`, x.osnovna, 'inputmode="decimal" class="usko"')}</td>
        ${y.razdoblja.map((_, i) => `<td>${ul(`godine.${g}.cijene.${a.oznaka}.r.${i}`, x.r[i] ?? '', 'inputmode="decimal" class="usko" placeholder="osn."')}</td>`).join('')}</tr>`; }).join('')}</tbody>
    </table></div>
    <label class="kratko">Min. noći u ${g}. (ako nije drugačije)${ul(`godine.${g}.minNoci`, y.minNoci, 'inputmode="numeric" placeholder="zadano"')}</label>
  </section>`).join('')}
  <section class="kartica"><div class="red">
    <button type="button" class="gumb glavni" id="o-spremi">Spremi osnovne cijene</button>
    <button type="button" class="gumb" id="o-racuni">Popuni osnovne cijene iz Računa (2026. i 2027.)</button>
    <button type="button" class="gumb" id="o-ponisti">Poništi promjene</button>
  </div><p class="mala">„Popuni iz Računa“ samo upiše cijene u polja; spremaju se tek gumbom „Spremi“.</p></section>`;
}

function procitajNacrt(el) {
  for (const x of $$('[data-p]', el)) {
    const put = x.dataset.p.split('.'), kraj = put.pop();
    put.reduce((o, k) => o[k], NACRT)[kraj] = x.value;
  }
}
function veziOsnovno(el) {
  // bez ponovnog iscrtavanja (da klik na Spremi ne nestane): samo osvježi naslove stupaca i polje za dodatak
  $$('[data-p$=".osnovnaZa"]', el).forEach((x) => (x.onchange = () => {
    const td = x.closest('tr').querySelector('[data-dodatak]'), ista = +x.value >= +td.dataset.dodatak;
    td.children[0].hidden = !ista;
    td.children[1].hidden = ista;
  }));
  $$('[data-p*=".razdoblja."]', el).forEach((x) => (x.oninput = () => {
    const [, g, , i] = x.dataset.p.split('.'), od = $(`[data-p="godine.${g}.razdoblja.${i}.od"]`, el).value, doo = $(`[data-p="godine.${g}.razdoblja.${i}.do"]`, el).value;
    $(`[data-th="${g}|${i}"]`, el).textContent = `${od || '?'}–${doo || '?'}`;
  }));
  $$('[data-dodaj]', el).forEach((b) => (b.onclick = () => {
    procitajNacrt(el);
    const y = NACRT.godine[b.dataset.dodaj];
    y.razdoblja.push({ od: '', do: '', minNoci: '' });
    Object.values(y.cijene).forEach((c) => c.r.push(''));
    render();
  }));
  $$('[data-ukloni]', el).forEach((b) => (b.onclick = () => {
    procitajNacrt(el);
    const [g, i] = b.dataset.ukloni.split('|'), y = NACRT.godine[g];
    y.razdoblja.splice(+i, 1);
    Object.values(y.cijene).forEach((c) => c.r.splice(+i, 1));
    render();
  }));
  $('#o-racuni').onclick = () => {
    procitajNacrt(el);
    let n = 0;
    for (const [g, cj] of Object.entries(CJENIK_RACUNI)) {
      if (!NACRT.godine[g]) continue;
      for (const [o, v] of Object.entries(cj)) if (NACRT.godine[g].cijene[o]) { NACRT.godine[g].cijene[o].osnovna = String(v); n++; }
    }
    render();
    poruka(n ? 'Cijene iz Računa upisane. Provjerite i kliknite Spremi.' : 'Nema godina 2026. i 2027. u tablici.');
  };
  $('#o-ponisti').onclick = () => { NACRT = null; render(); };
  $('#o-spremi').onclick = async (e) => {
    procitajNacrt(el);
    const tijelo = { apartmani: {}, razdoblja: {} };
    for (const a of aps()) {
      const x = NACRT.aps[a.oznaka];
      tijelo.apartmani[a.oznaka] = { osnovnaZa: +x.osnovnaZa, dodatak: { tip: x.tip, vrijednost: broj(x.vrijednost) || 0 }, minNoci: broj(x.minNoci) || 1, godine: {} };
    }
    for (const [g, y] of Object.entries(NACRT.godine)) {
      const raz = [];
      for (const r of y.razdoblja) {
        if (!r.od.trim() && !r.do.trim()) continue;
        const od = mmdd(r.od), doo = mmdd(r.do);
        if (!od || !doo) return poruka(`Razdoblje u ${g}.: upišite datume kao 1.6. i 30.9.`);
        raz.push({ od, do: doo, minNoci: broj(r.minNoci) || undefined, i: y.razdoblja.indexOf(r) });
      }
      // isti dan ne smije biti u dva razdoblja
      const dani = {};
      for (const r of raz) for (let d = new Date(Date.UTC(2024, +r.od.slice(0, 2) - 1, +r.od.slice(3))), n = 0; n < 366; n++, d.setUTCDate(d.getUTCDate() + 1)) {
        const k = d.toISOString().slice(5, 10);
        if (dani[k]) return poruka(`${g}.: razdoblja ${md(dani[k].od)}–${md(dani[k].do)} i ${md(r.od)}–${md(r.do)} se preklapaju.`);
        dani[k] = r;
        if (k === r.do) break;
      }
      tijelo.razdoblja[g] = raz.map(({ od, do: doo, minNoci }) => ({ od, do: doo, minNoci }));
      for (const a of aps()) {
        const c = y.cijene[a.oznaka], osn = broj(c.osnovna);
        if (osn != null && !(osn > 0)) return poruka(`${a.naziv}, ${g}.: cijena mora biti broj veći od 0.`);
        const sezone = [];
        for (const r of raz) {
          const v = broj(c.r[r.i]);
          if (v == null) continue;
          if (!(v > 0)) return poruka(`${a.naziv}, ${g}.: cijena mora biti broj veći od 0.`);
          sezone.push({ od: r.od, do: r.do, cijena: v, minNoci: r.minNoci });
        }
        if (osn != null || sezone.length) tijelo.apartmani[a.oznaka].godine[g] = { cijena: osn, minNoci: broj(y.minNoci) || undefined, sezone };
      }
    }
    e.target.disabled = true;
    try {
      await api('osnovno', tijelo);
      NACRT = null;
      poruka('Osnovne cijene spremljene');
      render();
    } finally { e.target.disabled = false; }
  };
}

// ---------------------------------------------------------------- Zatvoreno
const zOdabir = new Set();
function karticaZatvoreno() {
  const z = S.podaci.zatvoreno || [];
  return `<section class="kartica">
    <h2>Zatvoreno samo na webu</h2>
    <p class="mala">Zatvaranja na Bookingu i Airbnbu web pokupi sam iz kalendara. Ovdje zatvarate termine samo za web (npr. dok dogovarate upit).</p>
    ${cipoviApartmana(zOdabir, 'z-ap')}
    <div class="mreza">
      <label>Dolazak<input type="date" id="z-od"></label>
      <label>Odlazak<input type="date" id="z-do"></label>
      <label>Napomena (vidite samo vi)<input id="z-nap" maxlength="200"></label>
      <button type="button" class="gumb glavni" id="z-dodaj">Zatvori termin</button>
    </div>
  </section>
  <section class="kartica"><h3>Zatvoreni termini</h3>
    ${z.length ? `<ul class="popis">${z.map((x) => `<li><span><b>${fd(x.od)} – ${fd(x.do)}</b> · ${esc(x.apartmani.map(naziv).join(', '))}${x.napomena ? ` · <span class="mala">${esc(x.napomena)}</span>` : ''}</span><button type="button" class="gumb opasno" data-otvori="${esc(x.id)}">Otvori</button></li>`).join('')}</ul>` : '<p class="mala">Nema zatvorenih termina.</p>'}
  </section>`;
}
function veziZatvoreno(el) {
  veziCipove(el, 'z-ap', zOdabir);
  $('#z-dodaj').onclick = async () => {
    const od = $('#z-od').value, doo = $('#z-do').value;
    if (!zOdabir.size || !od || !doo || doo <= od) return poruka('Odaberite apartmane, dolazak i odlazak.');
    await api('zatvori', { apartmani: [...zOdabir], od, do: doo, napomena: $('#z-nap').value });
    poruka('Termin zatvoren');
    render();
  };
  $$('[data-otvori]', el).forEach((b) => (b.onclick = async () => {
    if (b.dataset.ok !== '1') { b.dataset.ok = '1'; b.textContent = 'Potvrdi'; return; }
    await api('otvori', { id: b.dataset.otvori });
    poruka('Termin otvoren');
    render();
  }));
}

// ---------------------------------------------------------------- Kalendari
function karticaKalendari() {
  const p = S.podaci.postavke, ic = S.podaci.ical || {}, kan = p.kanali || {};
  const kad = (t) => (t ? new Date(t * 1000).toLocaleString('hr-HR', { dateStyle: 'short', timeStyle: 'short' }) : 'nikad');
  const st = (o, k) => {
    const s = ic[`${o}|${k}`];
    if (!s) return '';
    return s.greska ? `<span class="stanje-lose">greška: ${esc(s.greska)}</span> <span class="mala">(zadnji uspjeh ${kad(s.uspjeh)})</span>` : `<span class="stanje-ok">✓ ${kad(s.uspjeh)}</span> <span class="mala">${s.rasponi} raspona</span>`;
  };
  return `<section class="kartica">
    <h2>Kalendari Booking i Airbnb</h2>
    <p class="mala">Zauzetost na webu dolazi iz ovih kalendara (iCal izvoz). Booking: extranet → Cijene i dostupnost → Sinkronizacija kalendara → Izvoz. Airbnb: Kalendar → oglas → Dostupnost → Izvoz kalendara. Osvježava se automatski (cron); zadnje osvježavanje weba: <b>${S.podaci.dostupnost.azurirano ? new Date(S.podaci.dostupnost.azurirano).toLocaleString('hr-HR', { dateStyle: 'short', timeStyle: 'short' }) : 'još nije'}</b>.</p>
    ${aps().map((a) => `<fieldset class="kartica"><h3>${esc(a.naziv)} <span class="mala">· ${esc(a.vlasnik)}</span></h3>
      <label>Booking.com ${st(a.oznaka, 'booking')}<input type="url" data-o="${esc(a.oznaka)}" data-k="booking" value="${esc(p.ical?.[a.oznaka]?.booking || '')}" placeholder="https://ical.booking.com/v1/export?t=…" autocomplete="off"></label>
      <label>Airbnb ${st(a.oznaka, 'airbnb')}<input type="url" data-o="${esc(a.oznaka)}" data-k="airbnb" value="${esc(p.ical?.[a.oznaka]?.airbnb || '')}" placeholder="https://www.airbnb.com/calendar/ical/….ics?s=…" autocomplete="off"></label>
    </fieldset>`).join('')}
    <h3>Razlika cijena po kanalu</h3>
    <p class="mala">Samo pomoć pri ručnom upisu: uz cijenu za web pokaže se koliko upisati na Booking i Airbnb.</p>
    <div class="mreza"><label>Booking +%<input id="k-b" inputmode="decimal" value="${esc(kan.booking || 0)}"></label><label>Airbnb +%<input id="k-a" inputmode="decimal" value="${esc(kan.airbnb || 0)}"></label></div>
    <div class="red"><button type="button" class="gumb glavni" id="k-spremi">Spremi</button><button type="button" class="gumb" id="k-osvjezi">Osvježi kalendare sada</button></div>
  </section>`;
}
function veziKalendari(el) {
  $('#k-spremi').onclick = async () => {
    const ical = {};
    $$('input[data-o]', el).forEach((x) => { if (x.value.trim()) (ical[x.dataset.o] ||= {})[x.dataset.k] = x.value.trim(); });
    const n = (v) => parseFloat(String(v).replace(',', '.')) || 0;
    await api('postavke', { ical, kanali: { booking: n($('#k-b').value), airbnb: n($('#k-a').value) } });
    poruka('Spremljeno');
    render();
  };
  $('#k-osvjezi').onclick = async (e) => {
    e.target.disabled = true;
    e.target.textContent = 'Osvježavam…';
    try {
      const r = await api('osvjezi', {});
      poruka(r.rezultat.greske.length ? `Greške: ${r.rezultat.greske.length} (vidi popis)` : `Osvježeno: ${r.rezultat.ok} kalendara`);
      render();
    } finally { e.target.disabled = false; }
  };
}

// ---------------------------------------------------------------- Sigurnost (dvofaktorska prijava)
const TFA = { korak: null, tajna: '', uri: '', kodovi: null };
function karticaSigurnost() {
  const d = S.podaci.dvofaktorska || {};
  if (TFA.kodovi) return `<section class="kartica">
    <h2>Rezervni kodovi</h2>
    <p class="upozorenje">Spremite ih sada (ispis ili datoteka na sigurnom mjestu). Svaki vrijedi jednom, za prijavu kad mobitel nije pri ruci. Više se neće prikazati.</p>
    <div class="kodovi">${TFA.kodovi.map(esc).join('<br>')}</div>
    <div class="red"><button type="button" class="gumb" id="t-preuzmi">Preuzmi kao datoteku</button><button type="button" class="gumb glavni" id="t-spremio">Spremio sam kodove</button></div>
  </section>`;
  if (TFA.korak === 'skeniraj') return `<section class="kartica">
    <h2>Uključivanje dvofaktorske prijave</h2>
    <ol class="mala">
      <li>Na mobitelu instalirajte <b>Google Authenticator</b> (ili Microsoft Authenticator).</li>
      <li>U aplikaciji: <b>+</b> → <b>Skeniraj QR kod</b> i skenirajte kod ispod. Ako ste na mobitelu: <b>Unesi ključ za postavljanje</b> i prepišite ključ.</li>
      <li>Upišite 6 brojki koje aplikacija prikaže.</li>
    </ol>
    <div class="qr" id="t-qr" role="img" aria-label="QR kod za aplikaciju"></div>
    <p class="mala">Ključ: <span class="kljuc">${esc(TFA.tajna.replace(/(.{4})/g, '$1 ').trim())}</span></p>
    <div class="mreza"><label>Kod iz aplikacije<input id="t-kod" inputmode="numeric" autocomplete="one-time-code" maxlength="7"></label>
      <button type="button" class="gumb glavni" id="t-ukljuci">Uključi</button><button type="button" class="gumb" id="t-odustani">Odustani</button></div>
  </section>`;
  return `<section class="kartica">
    <h2>Dvofaktorska prijava</h2>
    ${d.ukljucena
      ? `<p><b class="stanje-ok">Uključena.</b> Pri prijavi se uz lozinku traži kod s mobitela. Preostalo rezervnih kodova: <b>${d.rezervnih}</b>.</p>
         <div class="mreza"><label>Vaša lozinka<input type="password" id="t-loz" autocomplete="current-password"></label><label>Kod iz aplikacije<input id="t-kod" inputmode="numeric" autocomplete="one-time-code" maxlength="12"></label>
         <button type="button" class="gumb" id="t-novi">Novi rezervni kodovi</button><button type="button" class="gumb opasno" id="t-iskljuci">Isključi</button></div>`
      : `<p class="mala">Uz lozinku traži se i 6 brojki iz aplikacije na mobitelu: tko sazna lozinku, bez vašeg mobitela ne može ući. Preporučeno, posebno kad web ode u javnost.</p>
         <div class="mreza"><label>Vaša lozinka<input type="password" id="t-loz" autocomplete="current-password"></label><button type="button" class="gumb glavni" id="t-pocni">Uključi dvofaktorsku prijavu</button></div>`}
    <p class="mala">Izgubljen mobitel i rezervni kodovi: u cPanelu → File Manager → <code>web-podaci</code> obrišite <code>dvofaktorska.json</code>, pa se prijavite samo lozinkom.</p>
  </section>`;
}
function veziSigurnost(el) {
  const loz = () => $('#t-loz')?.value || '';
  const kod = () => $('#t-kod')?.value.trim() || '';
  if (TFA.korak === 'skeniraj' && !TFA.kodovi) {
    try { const q = qrcode(0, 'M'); q.addData(TFA.uri); q.make(); $('#t-qr').innerHTML = q.createSvgTag(4, 8); } catch { $('#t-qr').hidden = true; }
  }
  $('#t-pocni')?.addEventListener('click', async () => {
    if (!loz()) return poruka('Upišite svoju lozinku.');
    const r = await api('2fa-pocni', { lozinka: loz() });
    Object.assign(TFA, { korak: 'skeniraj', tajna: r.tajna, uri: r.uri });
    render();
  });
  $('#t-ukljuci')?.addEventListener('click', async () => {
    const r = await api('2fa-ukljuci', { kod: kod() });
    Object.assign(TFA, { korak: null, kodovi: r.kodovi });
    poruka('Dvofaktorska prijava je uključena');
    render();
  });
  $('#t-odustani')?.addEventListener('click', () => { TFA.korak = null; render(); });
  $('#t-novi')?.addEventListener('click', async () => {
    const r = await api('2fa-kodovi', { lozinka: loz(), kod: kod() });
    TFA.kodovi = r.kodovi;
    render();
  });
  $('#t-iskljuci')?.addEventListener('click', async (e) => {
    if (e.target.dataset.ok !== '1') { e.target.dataset.ok = '1'; e.target.textContent = 'Potvrdi isključivanje'; return; }
    await api('2fa-iskljuci', { lozinka: loz(), kod: kod() });
    poruka('Dvofaktorska prijava je isključena');
    render();
  });
  $('#t-preuzmi')?.addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([`Apartments Rašpolić – admin weba\nRezervni kodovi (${new Date().toLocaleDateString('hr-HR')})\n\n${TFA.kodovi.join('\n')}\n\nSvaki kod vrijedi jednom.\n`], { type: 'text/plain' }));
    a.download = 'admin-web-rezervni-kodovi.txt';
    a.click();
  });
  $('#t-spremio')?.addEventListener('click', () => { TFA.kodovi = null; render(); });
}

// ---------------------------------------------------------------- okvir
const KARTICE = { cijene: [karticaCijene, veziCijene], osnovno: [karticaOsnovno, veziOsnovno], zatvoreno: [karticaZatvoreno, veziZatvoreno], kalendari: [karticaKalendari, veziKalendari], sigurnost: [karticaSigurnost, veziSigurnost] };
function render() {
  const el = $('#app'), [html, vezi] = KARTICE[S.kartica];
  const x = scrollX, y = scrollY, omot = $('.omot')?.scrollLeft;
  el.innerHTML = html();
  vezi(el);
  scrollTo(x, y);
  if (omot != null && $('.omot')) $('.omot').scrollLeft = omot;
}
$$('.kartice button').forEach((b) => (b.onclick = () => {
  S.kartica = b.dataset.k;
  $$('.kartice button').forEach((x) => x.setAttribute('aria-current', String(x === b)));
  render();
}));
$('#odjava').onclick = async () => { await api('odjava', {}); location.reload(); };

api('stanje').then((d) => { S.podaci = d; if (!S.odabir.od) { S.odabir.od = danas(); S.odabir.do = dodajDane(danas(), 6); } render(); });
