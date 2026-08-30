import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';

async function json(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

function host(url) {
  return new URL(url).hostname.replace(/^www\./, '');
}

export async function buildGuidePackage(packageDir, { publish = false } = {}) {
  const [run, guide] = await Promise.all([
    json(path.join(packageDir, 'run.json')),
    json(path.join(packageDir, 'guide.json'))
  ]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(run.date || '')) throw new Error('run.json 날짜가 없습니다.');
  if (!/^[a-z0-9-]+$/.test(run.slug || '')) throw new Error('영문 slug가 없습니다.');
  if (!Array.isArray(guide.cards) || guide.cards.length !== 8) throw new Error('카드는 정확히 8장이어야 합니다.');
  if (!Array.isArray(guide.sources) || !guide.sources.length) throw new Error('검증 출처가 없습니다.');

  const externalChannels = Object.entries(run.channels || {})
    .filter(([name, value]) => name !== 'site' && value?.state === 'published' && value?.url)
    .map(([name, value]) => ({
      name: name === 'naver' ? '네이버 블로그' : name === 'tistory' ? '티스토리' : 'Instagram',
      url: value.url
    }));
  const publicBase = `/content/guides/${run.slug}`;
  const cards = guide.cards.map((card, index) => ({
    image: `${publicBase}/slide-${String(index + 1).padStart(2, '0')}.png`,
    title: card.title,
    description: card.description,
    alt: card.alt
  }));
  const sources = guide.sources.map((source) => {
    const url = typeof source === 'string' ? source : source.url;
    return {
      title: typeof source === 'string' ? host(url) : source.title || host(url),
      url,
      publisher: typeof source === 'string' ? host(url) : source.publisher || host(url)
    };
  });
  const frontmatter = {
    title: guide.title,
    description: guide.description,
    subtitle: guide.subtitle || guide.description,
    slug: run.slug,
    author: '카일루스',
    ...(publish ? { publishedAt: run.date } : {}),
    updatedAt: run.date,
    editorialApproved: publish,
    draft: !publish,
    featured: false,
    contentTier: 'flagship',
    summary: guide.summary,
    highlights: guide.highlights,
    related: guide.related || [],
    sources,
    cards,
    externalChannels,
    category: guide.category
  };
  return { slug: run.slug, frontmatter, body: String(guide.bodyMarkdown || '').trim(), cards };
}

export async function writeGuidePackage(packageDir, siteRoot, options = {}) {
  const output = await buildGuidePackage(packageDir, options);
  const contentFile = path.join(siteRoot, 'src/content/guides', `${output.slug}.md`);
  const assetDir = path.join(siteRoot, 'public/content/guides', output.slug);
  if (!options.force) {
    try {
      await access(contentFile);
      throw new Error(`이미 존재하는 가이드입니다: ${output.slug}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  await mkdir(path.dirname(contentFile), { recursive: true });
  await mkdir(assetDir, { recursive: true });
  for (let index = 1; index <= 8; index += 1) {
    const name = `slide-${String(index).padStart(2, '0')}.png`;
    await copyFile(path.join(packageDir, 'channels/instagram/cards', name), path.join(assetDir, name));
  }
  const markdown = `---\n${stringify(output.frontmatter, { lineWidth: 0 }).trim()}\n---\n\n${output.body}\n`;
  await writeFile(contentFile, markdown, 'utf8');
  return { ...output, contentFile, assetDir };
}

function parseArgs(argv) {
  const args = { publish: false, write: false, force: false, siteRoot: process.cwd() };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--package-dir') args.packageDir = argv[++index];
    else if (value === '--site-root') args.siteRoot = argv[++index];
    else if (value === '--publish') args.publish = true;
    else if (value === '--write') args.write = true;
    else if (value === '--force') args.force = true;
    else throw new Error(`알 수 없는 인자: ${value}`);
  }
  if (!args.packageDir) throw new Error('--package-dir가 필요합니다.');
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = args.write
    ? await writeGuidePackage(args.packageDir, args.siteRoot, args)
    : await buildGuidePackage(args.packageDir, args);
  process.stdout.write(`${JSON.stringify({ slug: result.slug, draft: result.frontmatter.draft, bodyChars: result.body.length, cards: result.cards.length, contentFile: result.contentFile || null }, null, 2)}\n`);
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (fileURLToPath(import.meta.url) === invoked) main().catch((error) => { console.error(error.message); process.exit(1); });
