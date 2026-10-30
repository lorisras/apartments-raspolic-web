import podaci from '../data/apartmani.json';
import { JEZICI, url } from '../i18n/ui.js';

export function GET({ site }) {
  const grupe = [
    (j) => url.naslovnica(j),
    ...podaci.apartmani.map((a) => (j) => url.apartman(j, a.oznaka)),
    (j) => url.stranica(j, 'upit'),
    (j) => url.stranica(j, 'pravila'),
  ];
  const abs = (p) => new URL(p, site).href;
  const stavke = grupe.flatMap((fn) => JEZICI.map((j) => `  <url><loc>${abs(fn(j))}</loc>${JEZICI.map((k) => `<xhtml:link rel="alternate" hreflang="${k}" href="${abs(fn(k))}"/>`).join('')}</url>`));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${stavke.join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}
