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

const S = { podaci: null, kartica: 'cijene', mjesec: danas().slice(0, 7), odabir: { od: '', do: '', aps: new Set(), sidro: null }, osnovnoAp: null };

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
function karticaOsnovno() {
  const o = (S.osnovnoAp ||= aps()[0]?.oznaka);
  const a = aps().find((x) => x.oznaka === o), cj = cjenik(o);
  const dod = cj.dodatak || { tip: 'iznos', vrijednost: 0 };
  const g0 = new Date().getFullYear();
  const godine = [...new Set([g0, g0 + 1, ...Object.keys(cj.godine || {}).map(Number)])].filter((g) => g >= g0).sort();
  const md = (v) => (v ? `${+v.slice(3)}.${+v.slice(0, 2)}.` : '');
  const sezona = (s = {}) => `<div class="sezona">
      <label>Od (dd.mm.)<input data-s="od" value="${esc(md(s.od))}" placeholder="1.6." autocomplete="off"></label>
      <label>Do, zadnja noć<input data-s="do" value="${esc(md(s.do))}" placeholder="30.9." autocomplete="off"></label>
      <label>Cijena €<input data-s="cijena" inputmode="decimal" value="${esc(s.cijena ?? '')}"></label>
      <label>Min. noći<input data-s="minNoci" inputmode="numeric" value="${esc(s.minNoci ?? '')}" placeholder="—"></label>
      <button type="button" class="x" data-ukloni aria-label="Ukloni sezonu">×</button></div>`;
  return `<section class="kartica">
    <h2>Osnovne cijene</h2>
    <p class="mala">Osnovna cijena i sezone vrijede za dane kojima niste posebno promijenili cijenu (Cijene po danima). Dodatak se plaća po noći za svaku osobu iznad osnovnog broja; bebe do 2 godine se ne računaju.</p>
    <label>Apartman<select id="o-ap">${aps().map((x) => `<option value="${esc(x.oznaka)}" ${x.oznaka === o ? 'selected' : ''}>${esc(x.naziv)} (do ${x.maxOsoba} osoba)</option>`).join('')}</select></label>
    <div class="mreza">
      <label>Osnovna cijena vrijedi za<select id="o-za">${Array.from({ length: a.maxOsoba }, (_, i) => i + 1).map((n) => `<option ${n === (cj.osnovnaZa || ZADANO_OSNOVNA_ZA[o] || a.maxOsoba) ? 'selected' : ''} value="${n}">${n} ${n === 1 ? 'osobu' : n < 5 ? 'osobe' : 'osoba'}</option>`).join('')}</select></label>
      <label>Dodatak za osobu<select id="o-dt"><option value="iznos" ${dod.tip !== 'postotak' ? 'selected' : ''}>€ po noći</option><option value="postotak" ${dod.tip === 'postotak' ? 'selected' : ''}>% cijene noći</option></select></label>
      <label>Iznos dodatka<input id="o-dv" inputmode="decimal" value="${esc(dod.vrijednost || '')}" placeholder="0"></label>
      <label>Min. noćenja (zadano)<input id="o-min" inputmode="numeric" value="${esc(cj.minNoci || 1)}"></label>
    </div>
    ${godine.map((g) => { const y = cj.godine?.[g] || {}; return `<fieldset class="kartica" data-g="${g}"><h3>${g}.</h3>
      <div class="mreza"><label>Osnovna cijena € / noć<input data-y="cijena" inputmode="decimal" value="${esc(y.cijena ?? '')}"></label><label>Min. noći<input data-y="minNoci" inputmode="numeric" value="${esc(y.minNoci ?? '')}" placeholder="zadano"></label></div>
      <div class="sezone">${(y.sezone || []).map(sezona).join('')}</div>
      <div><button type="button" class="gumb" data-dodaj>+ Sezona</button></div></fieldset>`; }).join('')}
    <div class="red"><button type="button" class="gumb glavni" id="o-spremi">Spremi ${esc(a.naziv)}</button></div>
    <template id="t-sezona">${sezona()}</template>
  </section>`;
}
function veziOsnovno(el) {
  $('#o-ap').onchange = (e) => { S.osnovnoAp = e.target.value; render(); };
  const vezi = (k) => ($('[data-ukloni]', k).onclick = () => k.remove());
  $$('.sezona', el).forEach(vezi);
  $$('[data-dodaj]', el).forEach((b) => (b.onclick = () => {
    const box = b.closest('fieldset').querySelector('.sezone');
    box.append($('#t-sezona').content.cloneNode(true));
    vezi(box.lastElementChild);
  }));
  const mmdd = (v) => {
    const m = String(v).trim().match(/^(\d{1,2})\.\s*(\d{1,2})\.?$/);
    return m && +m[2] >= 1 && +m[2] <= 12 && +m[1] >= 1 && +m[1] <= 31 ? `${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
  };
  const br = (v) => (String(v).trim() === '' ? null : parseFloat(String(v).replace(',', '.')));
  $('#o-spremi').onclick = async (e) => {
    const godine = {};
    for (const fs of $$('fieldset[data-g]', el)) {
      const sezone = [];
      for (const s of $$('.sezona', fs)) {
        const od = mmdd($('[data-s=od]', s).value), doo = mmdd($('[data-s=do]', s).value), c = br($('[data-s=cijena]', s).value);
        if (!od && !doo && c == null) continue;
        if (!od || !doo || !(c > 0)) return poruka(`Sezona u ${fs.dataset.g}.: upišite datume kao 1.6. i cijenu.`);
        sezone.push({ od, do: doo, cijena: c, minNoci: br($('[data-s=minNoci]', s).value) || undefined });
      }
      const c = br($('[data-y=cijena]', fs).value);
      if (c != null || sezone.length) godine[fs.dataset.g] = { cijena: c, minNoci: br($('[data-y=minNoci]', fs).value) || undefined, sezone };
    }
    e.target.disabled = true;
    try {
      await api('osnovno', { apartman: S.osnovnoAp, osnovnaZa: +$('#o-za').value, dodatak: { tip: $('#o-dt').value, vrijednost: br($('#o-dv').value) || 0 }, minNoci: br($('#o-min').value) || 1, godine });
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
