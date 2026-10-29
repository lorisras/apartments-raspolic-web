import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Opis apartmana: src/content/apartmani/<oznaka>/<jezik>.md
// U zaglavlju (frontmatter) su raspored spavanja i oprema, ispod je slobodan tekst opisa.
const apartmani = defineCollection({
  loader: glob({ pattern: '*/*.md', base: './src/content/apartmani' }),
  schema: z.object({
    opis: z.string().optional(),            // kratki opis za tražilice (meta description)
    spavanje: z.array(z.object({ prostorija: z.string(), opis: z.string() })).default([]),
    oprema: z.array(z.string()).default([]),
  }),
});

export const collections = { apartmani };
