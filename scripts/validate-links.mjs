import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';

const root = process.cwd();
const dist = path.join(root, 'dist');
const errors = [];

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? filesIn(target) : target;
    })
  );
  return nested.flat();
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function targetFor(urlPath) {
  const decoded = decodeURIComponent(urlPath.split(/[?#]/)[0]);
  if (decoded === '/') return path.join(dist, 'index.html');
  const relative = decoded.replace(/^\//, '');
  if (path.extname(relative)) return path.join(dist, relative);
  return path.join(dist, relative, 'index.html');
}

const files = await filesIn(dist);
const htmlFiles = files.filter((file) => file.endsWith('.html'));
for (const htmlFile of htmlFiles) {
  const source = await readFile(htmlFile, 'utf8');
  const references = [...source.matchAll(/(?:href|src)=["']([^"']+)["']/g)].map((match) => match[1]);

  for (const reference of references) {
    if (!reference.startsWith('/') || reference.startsWith('//')) continue;
    const target = targetFor(reference);
    if (!(await exists(target))) {
      errors.push(`${path.relative(dist, htmlFile)} → ${reference}`);
    }
  }
}

const sitemap = await readFile(path.join(dist, 'sitemap.xml'), 'utf8');

async function contentPaths(collection) {
  const directory = path.join(root, 'src', 'content', collection);
  const markdown = (await filesIn(directory)).filter((file) => file.endsWith('.md'));
  const records = [];

  for (const file of markdown) {
    const source = await readFile(file, 'utf8');
    const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!frontmatter) continue;
    const data = parse(frontmatter[1]);
    records.push({ path: `/${collection}/${data.slug}/`, draft: data.draft });
  }

  return records;
}

const contentRecords = [...(await contentPaths('articles')), ...(await contentPaths('columns'))];
const expectedPublicPaths = contentRecords.filter((record) => record.draft === false).map((record) => record.path);
const draftPaths = contentRecords.filter((record) => record.draft === true).map((record) => record.path);

for (const publicPath of expectedPublicPaths) {
  if (!sitemap.includes(publicPath)) errors.push(`sitemap.xml에 공개 경로가 없습니다: ${publicPath}`);
  if (!(await exists(targetFor(publicPath)))) errors.push(`공개 콘텐츠 페이지가 빌드되지 않았습니다: ${publicPath}`);
}
for (const draftPath of draftPaths) {
  if (sitemap.includes(draftPath)) errors.push(`sitemap.xml에 초안 경로가 노출됐습니다: ${draftPath}`);
  if (await exists(targetFor(draftPath))) errors.push(`초안 콘텐츠 페이지가 빌드됐습니다: ${draftPath}`);
}

if (errors.length) {
  console.error(`빌드 링크 검증 실패 (${errors.length}건)`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`링크 검증 완료: HTML ${htmlFiles.length}개, 공개 콘텐츠 ${expectedPublicPaths.length}개`);
