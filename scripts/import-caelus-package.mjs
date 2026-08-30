import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';

const CLAIM_MARKER = /\s*\((?:CL|L)-?\d+(?:\s*,\s*(?:CL|L)-?\d+)*\)/gi;

async function json(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function host(url) {
  return new URL(url).hostname.replace(/^www\./, '');
}

function cleanTitle(date, rawTitle) {
  const [, month, day] = date.match(/^(\d{4})-(\d{2})-(\d{2})$/) || [];
  if (!month) throw new Error(`잘못된 패키지 날짜: ${date}`);
  const topic = String(rawTitle || '')
    .replace(/^\[\d{1,2}\/\d{1,2}\s*이슈\]\s*/, '')
    .replace(/\s*&\s*/g, ' · ')
    .trim();
  return `${date.slice(0, 4)}년 ${Number(month)}월 ${Number(day)}일 Caelus 마켓 브리핑 — ${topic}`;
}

function cleanMaster(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const output = [];
  let skippedTitle = false;
  for (let line of lines) {
    if (!skippedTitle && line.trim()) {
      skippedTitle = true;
      continue;
    }
    if (/^발행 시각:/.test(line.trim())) continue;
    if (/^\[(?:IMAGE|CHART):[^\]]+\]$/.test(line.trim())) continue;
    line = line.replace(CLAIM_MARKER, '').replace(/[ \t]+$/g, '');
    if (/^이슈\s+\d+/.test(line)) line = `## ${line}`;
    else if (/^(영향과 전망|관련 주식)$/.test(line)) line = `### ${line}`;
    output.push(line);
  }
  return output.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export async function buildBriefingPackage(packageDir, { publish = false } = {}) {
  const [run, article, brief, claimsDoc, manifest, master] = await Promise.all([
    json(path.join(packageDir, 'run.json')),
    json(path.join(packageDir, 'article.json')),
    json(path.join(packageDir, 'brief.json')),
    json(path.join(packageDir, 'claims.json')),
    json(path.join(packageDir, 'channels/instagram/manifest.json')),
    readFile(path.join(packageDir, 'master.md'), 'utf8')
  ]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(run.date || '')) throw new Error('run.json 날짜가 없습니다.');
  if (!Array.isArray(manifest.slides) || manifest.slides.length !== 8) throw new Error('카드는 정확히 8장이어야 합니다.');

  const usedIds = new Set(manifest.used_claim_ids || article.usedClaimIds || []);
  const verified = (claimsDoc.claims || []).filter((claim) => claim.status === 'verified' && usedIds.has(claim.id));
  const sourceUrls = unique(verified.flatMap((claim) => claim.sources || []));
  if (!sourceUrls.length) throw new Error('공개 가능한 검증 출처가 없습니다.');

  const slug = run.date;
  const publicBase = `/content/briefings/${slug}`;
  const cards = manifest.slides.map((slide, index) => ({
    image: `${publicBase}/slide-${String(index + 1).padStart(2, '0')}.png`,
    title: String(slide.title || `카드 ${index + 1}`).trim(),
    description: [slide.message, `시장 영향: ${slide.impact}`, `다음 확인: ${slide.watch}`].filter(Boolean).join(' '),
    alt: String(article.imageAlt?.[`slide-${String(index + 1).padStart(2, '0')}`] || `${slide.title}의 시장 영향과 다음 확인 지표를 설명하는 Caelus 카드뉴스`).trim()
  }));
  const selectedIds = new Set(brief.selected?.issues || []);
  const candidates = (brief.candidates || []).filter((item) => selectedIds.has(item.id));
  const rows = manifest.summary_rows || [];
  const title = cleanTitle(run.date, article.title);
  const externalChannels = Object.entries(run.channels || {})
    .filter(([name, value]) => name !== 'site' && value?.state === 'published' && value?.url)
    .map(([name, value]) => ({ name: name === 'naver' ? '네이버 블로그' : name === 'tistory' ? '티스토리' : 'Instagram', url: value.url }));
  const frontmatter = {
    title,
    description: `${rows.map((row) => row.issue).join(' · ')}의 시장 영향과 다음 확인 지표를 출처와 함께 정리합니다.`,
    subtitle: `${rows.map((row) => row.issue).join(' · ')}를 사실, 전달 경로와 확인 지표로 나누어 살펴봅니다.`,
    slug,
    author: '카일루스',
    ...(publish ? { publishedAt: run.date } : {}),
    reviewedAt: run.date,
    editorialApproved: publish,
    draft: !publish,
    featured: false,
    contentTier: 'flagship',
    summary: rows.map((row) => `${row.issue}: ${row.impact}`).join(' '),
    highlights: rows.map((row) => `${row.issue} — ${row.watch}`),
    related: [],
    sources: sourceUrls.map((url) => ({ title: host(url), url, publisher: host(url) })),
    cards,
    externalChannels,
    briefingDate: run.date,
    coverageStart: brief.coverage_start,
    coverageEnd: brief.coverage_end,
    topics: rows.map((row) => row.issue),
    markets: unique(candidates.map((item) => item.market || '글로벌 시장')),
    originalChannels: []
  };
  return { slug, frontmatter, body: cleanMaster(master), cards };
}

export async function writeBriefingPackage(packageDir, siteRoot, options = {}) {
  const output = await buildBriefingPackage(packageDir, options);
  const contentFile = path.join(siteRoot, 'src/content/briefings', `${output.slug}.md`);
  const assetDir = path.join(siteRoot, 'public/content/briefings', output.slug);
  if (!options.force) {
    try {
      await access(contentFile);
      throw new Error(`이미 존재하는 브리핑입니다: ${output.slug}`);
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
    ? await writeBriefingPackage(args.packageDir, args.siteRoot, args)
    : await buildBriefingPackage(args.packageDir, args);
  process.stdout.write(`${JSON.stringify({ slug: result.slug, draft: result.frontmatter.draft, bodyChars: result.body.length, cards: result.cards.length, contentFile: result.contentFile || null }, null, 2)}\n`);
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (fileURLToPath(import.meta.url) === invoked) main().catch((error) => { console.error(error.message); process.exit(1); });
