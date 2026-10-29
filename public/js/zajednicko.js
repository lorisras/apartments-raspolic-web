// Zajedničko za skripte weba: podaci s poslužitelja, tekstovi, odabir gostiju, poveznice za WhatsApp.
import { danas } from './cijene.js';

export const T = JSON.parse(document.getElementById('tekstovi')?.textContent || '{}');

let obecanje = null;
/** Zauzetost i cjenici svih apartmana (/api/podaci.php). Vraća null ako poslužitelj nije dostupan. */
export function podaci() {
  obecanje ??= fetch('/api/podaci.php', { headers: { Accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  return obecanje;
}

const NF = () => new Intl.NumberFormat(T.lokal || 'hr-HR', { maximumFractionDigits: 2 });
export const eur = (n) => `${NF().format(Math.round(n * 100) / 100)} €`;
export const datumTekst = (d, opcije = { day: 'numeric', month: 'numeric', year: 'numeric' }) =>
  new Date(d + 'T12:00:00').toLocaleDateString(T.lokal || 'hr-HR', opcije);
export const nociTekst = (n) => `${n} ${new Intl.PluralRules(T.lokal || 'hr-HR').select(n) === 'one' ? T.noc?.one : T.noc?.other}`;

/** Čitanje i pisanje odabira u URL (?od=&do=&odrasli=&djeca=&bebe=), da se prenese između stranica. */
export function izUrla() {
  const q = new URLSearchParams(location.search);
  const dat = (k) => (/^\d{4}-\d{2}-\d{2}$/.test(q.get(k) || '') ? q.get(k) : '');
  const br = (k, z) => (q.has(k) ? Math.max(0, parseInt(q.get(k), 10) || 0) : z);
  return { od: dat('od'), do: dat('do'), odrasli: br('odrasli', 2), djeca: br('djeca', 0), bebe: br('bebe', 0), apartman: q.get('apartman') || '' };
}
export function uUrl(osnova, o) {
  const q = new URLSearchParams();
  for (const k of ['apartman', 'od', 'do']) if (o[k]) q.set(k, o[k]);
  for (const k of ['odrasli', 'djeca', 'bebe']) if (o[k] != null) q.set(k, o[k]);
  return `${osnova}${osnova.includes('?') ? '&' : '?'}${q}`;
}

/** Postavlja min. datume na poljima i odlazak barem dan nakon dolaska. */
export function veziDatume(od, doo) {
  const d = danas();
  od.min = d;
  const uskladi = () => {
    if (od.value) {
      const sutra = new Date(od.value + 'T12:00:00Z');
      sutra.setUTCDate(sutra.getUTCDate() + 1);
      doo.min = sutra.toISOString().slice(0, 10);
      if (!doo.value || doo.value <= od.value) doo.value = doo.min;
    } else doo.min = d;
  };
  od.addEventListener('change', uskladi);
  uskladi();
}

/** WhatsApp poruka s apartmanom i datumima. */
export function postaviWhatsApp(naziv, od, doo) {
  document.querySelectorAll('a[data-whatsapp]').forEach((a) => {
    const broj = a.dataset.whatsapp;
    if (!broj) return;
    let tekst = T.whatsapp_poruka || '';
    if (naziv) tekst += ` – ${naziv}`;
    if (od && doo) tekst += `, ${T.whatsapp_termin.replace('%od', datumTekst(od)).replace('%do', datumTekst(doo))}`;
    a.href = `https://wa.me/${broj}?text=${encodeURIComponent(tekst)}`;
  });
}
