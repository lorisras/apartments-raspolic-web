// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://apartments-raspolic.com',
  trailingSlash: 'always',
  build: { format: 'directory' },
  // Jezici se rade ručno (src/pages/[lang]/…, src/i18n/ui.ts) jer svaki jezik ima i prevedene putanje.
});
