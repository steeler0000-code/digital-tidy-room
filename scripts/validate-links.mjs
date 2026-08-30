import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';

const root = process.cwd();
const dist = path.join(root, 'dist');
const errors = [];
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? files(path.join(dir, entry.name)) : path.join(dir, entry.name)))).flat();
}
async function exists(file) { try { await access(file); return true; } catch { return false; } }
function target(url) {
  const relative = decodeURIComponent(url.split(/[?#]/)[0]).replace(/^\//, '');
  if (!relative) return path.join(dist, 'index.html');
  return path.extname(relative) ? path.join(dist, relative) : path.join(dist, relative, 'index.html');
}

const all = await files(dist);
const htmlFiles = all.filter((file) => file.endsWith('.html'));
for (const file of htmlFiles) {
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
    const reference = match[1];
    if (reference.startsWith('/') && !reference.startsWith('//') && !(await exists(target(reference)))) errors.push(`${path.relative(dist, file)} → ${reference}`);
  }
}

const sitemap = await readFile(path.join(dist, 'sitemap.xml'), 'utf8');
let publicCount = 0;
for (const collection of ['guides', 'briefings']) {
  for (const file of (await files(path.join(root, 'src/content', collection))).filter((item) => item.endsWith('.md'))) {
    const source = await readFile(file, 'utf8');
    const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) continue;
    const data = parse(match[1]);
    if (data.draft !== false) continue;
    publicCount += 1;
    const url = `/${collection}/${data.slug}/`;
    if (!sitemap.includes(url)) errors.push(`사이트맵 누락: ${url}`);
    if (!(await exists(target(url)))) errors.push(`페이지 누락: ${url}`);
  }
}
for (const old of ['/articles/folder-three-levels/', '/columns/criteria-before-delete/', '/categories/files-folders/']) if (await exists(target(old))) errors.push(`이전 페이지가 남아 있음: ${old}`);
for (const file of ['rss.xml', 'robots.txt', 'ads.txt']) if (!(await exists(path.join(dist, file)))) errors.push(`${file} 누락`);
if (errors.length) {
  console.error(`링크 검증 실패 (${errors.length}건)`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log(`링크 검증 완료: HTML ${htmlFiles.length}개, 공개 콘텐츠 ${publicCount}개`);
