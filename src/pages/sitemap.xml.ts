import type { APIRoute } from 'astro';
import { categories } from '@/data/categories';
import { getPublishedArticles, getPublishedColumns } from '@/lib/content';

const staticPaths = [
  '/', '/categories/', '/columns/', '/about/', '/author/', '/editorial-policy/', '/contact/', '/privacy/', '/terms/', '/disclaimer/', '/sitemap/'
];

type SitemapItem = { path: string; lastmod?: string };

export const GET: APIRoute = async ({ site }) => {
  const base = site || new URL('https://caelus-h.com');
  const articles = await getPublishedArticles();
  const columns = await getPublishedColumns();
  const items: SitemapItem[] = [
    ...staticPaths.map((path) => ({ path })),
    ...categories.map((category) => ({ path: `/categories/${category.slug}/` })),
    ...articles.map((article) => ({ path: `/articles/${article.data.slug}/`, lastmod: (article.data.updatedAt || article.data.publishedAt)?.toISOString() })),
    ...columns.map((column) => ({ path: `/columns/${column.data.slug}/`, lastmod: (column.data.updatedAt || column.data.publishedAt)?.toISOString() }))
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items
    .map(({ path, lastmod }) => `  <url>\n    <loc>${new URL(path, base)}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n  </url>`)
    .join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
