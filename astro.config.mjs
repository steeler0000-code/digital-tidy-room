import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';

const env = loadEnv('production', process.cwd(), '');
const site = process.env.SITE_URL || env.SITE_URL || 'https://caelus-h.com';

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory'
  }
});
