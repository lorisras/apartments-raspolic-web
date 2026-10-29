// /api/apartmani.json – popis apartmana za PHP (admin, upit, podaci). Generira se pri buildu iz src/data/apartmani.json.
import podaci from '../../data/apartmani.json';

export function GET() {
  const apartmani = podaci.apartmani.map(({ oznaka, naziv, vlasnik, maxOsoba }) => ({ oznaka, naziv, vlasnik, maxOsoba }));
  return new Response(JSON.stringify({ apartmani }), { headers: { 'Content-Type': 'application/json' } });
}
