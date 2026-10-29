// Fotografije iz src/assets/<mapa>/ poredane po imenu datoteke (01-…, 02-…). Astro ih sam smanjuje i pretvara u WebP.
const SVE = import.meta.glob('/src/assets/**/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', { eager: true });

export function slike(mapa) {
  return Object.entries(SVE)
    .filter(([put]) => put.startsWith(`/src/assets/${mapa}/`))
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([, modul]) => modul.default);
}
