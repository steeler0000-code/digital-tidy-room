import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';

const root = process.cwd();
const contentRoot = path.join(root, 'src', 'content');
const categories = new Set([
  'files-folders',
  'photos-media',
  'email-web',
  'backup-accounts',
  'digital-habits'
]);
const errors = [];

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? markdownFiles(target) : target;
    })
  );
  return nested.flat().filter((file) => file.endsWith('.md'));
}

function parseDocument(file, source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    errors.push(`${file}: YAML frontmatter를 찾을 수 없습니다.`);
    return null;
  }

  try {
    return { data: parse(match[1]), body: match[2] };
  } catch (error) {
    errors.push(`${file}: YAML 파싱 실패 — ${error.message}`);
    return null;
  }
}

function dateOnly(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(`${value}T00:00:00+09:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function loadCollection(name) {
  const directory = path.join(contentRoot, name);
  const files = await markdownFiles(directory);
  const documents = [];

  for (const absoluteFile of files) {
    const relativeFile = path.relative(root, absoluteFile);
    const source = await readFile(absoluteFile, 'utf8');
    const parsed = parseDocument(relativeFile, source);
    if (parsed) documents.push({ ...parsed, file: relativeFile, source });
  }

  return documents;
}

const articles = await loadCollection('articles');
const columns = await loadCollection('columns');

if (articles.length !== 15) errors.push(`정보 글은 15개여야 합니다. 현재 ${articles.length}개입니다.`);
if (columns.length !== 3) errors.push(`칼럼은 3개여야 합니다. 현재 ${columns.length}개입니다.`);

const publicArticles = articles.filter(({ data }) => data.draft === false);
const publicColumns = columns.filter(({ data }) => data.draft === false);
if (publicArticles.length < 5) errors.push(`공개 정보 글은 최소 5개여야 합니다. 현재 ${publicArticles.length}개입니다.`);
if (publicColumns.length < 1) errors.push(`공개 칼럼은 최소 1개여야 합니다. 현재 ${publicColumns.length}개입니다.`);

for (const [collectionName, documents] of [
  ['articles', articles],
  ['columns', columns]
]) {
  const slugs = new Set();
  const knownSlugs = new Set(documents.map(({ data }) => data.slug));

  for (const { data, body, file, source } of documents) {
    const requiredText = ['title', 'description', 'subtitle', 'slug', 'author', 'summary'];
    for (const field of requiredText) {
      if (typeof data[field] !== 'string' || !data[field].trim()) {
        errors.push(`${file}: ${field} 값이 필요합니다.`);
      }
    }

    if (!/^[a-z0-9-]+$/.test(data.slug ?? '')) errors.push(`${file}: slug 형식이 올바르지 않습니다.`);
    if (slugs.has(data.slug)) errors.push(`${file}: 중복 slug(${data.slug})입니다.`);
    slugs.add(data.slug);

    if (data.author !== '카일루스') errors.push(`${file}: 작성자 표기가 사이트 운영자와 다릅니다.`);
    if (typeof data.draft !== 'boolean') errors.push(`${file}: draft는 true 또는 false여야 합니다.`);
    if (!Array.isArray(data.highlights) || data.highlights.length < 2) errors.push(`${file}: 핵심 요약 항목이 2개 이상 필요합니다.`);
    if (!Array.isArray(data.sources) || data.sources.length < 1) errors.push(`${file}: 확인한 자료가 1개 이상 필요합니다.`);
    if (body.trim().length < 700) errors.push(`${file}: 본문이 지나치게 짧습니다.`);

    const publishedAt = dateOnly(data.publishedAt);
    const updatedAt = dateOnly(data.updatedAt);
    if (data.draft === false && !publishedAt) errors.push(`${file}: 공개 문서에는 유효한 publishedAt이 필요합니다.`);
    if (data.draft === true && data.publishedAt) errors.push(`${file}: 초안에는 미리 만든 발행일을 넣지 않습니다.`);
    if (publishedAt && publishedAt > new Date()) errors.push(`${file}: 미래 발행일은 사용할 수 없습니다.`);
    if (updatedAt && updatedAt > new Date()) errors.push(`${file}: 미래 수정일은 사용할 수 없습니다.`);
    if (publishedAt && updatedAt && updatedAt < publishedAt) errors.push(`${file}: 수정일이 발행일보다 빠릅니다.`);

    if (collectionName === 'articles' && !categories.has(data.category)) {
      errors.push(`${file}: 등록되지 않은 카테고리(${data.category})입니다.`);
    }

    for (const relatedSlug of data.related ?? []) {
      if (!knownSlugs.has(relatedSlug)) errors.push(`${file}: 관련 글 slug(${relatedSlug})가 존재하지 않습니다.`);
    }

    for (const sourceItem of data.sources ?? []) {
      try {
        const url = new URL(sourceItem.url);
        if (!['https:', 'http:'].includes(url.protocol)) throw new Error('unsupported protocol');
      } catch {
        errors.push(`${file}: 출처 URL이 올바르지 않습니다 — ${sourceItem.url}`);
      }
    }

    if (/lorem ipsum/i.test(source)) errors.push(`${file}: 더미 문구가 남아 있습니다.`);
  }
}

async function searchableTextFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? searchableTextFiles(target) : target;
    })
  );
  const textExtensions = new Set(['.astro', '.css', '.html', '.js', '.json', '.md', '.mjs', '.ts', '.txt', '.xml']);
  return nested.flat().filter((file) => textExtensions.has(path.extname(file)) || path.basename(file) === '_headers');
}

const searchableFiles = [
  ...(await searchableTextFiles(path.join(root, 'src'))),
  ...(await searchableTextFiles(path.join(root, 'public')).catch(() => []))
];
const forbiddenPatterns = [
  /01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/,
  /(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)(?:특별자치도|특별자치시|광역시|도|시)?\s+[^\n]{1,40}(?:로|길)\s*\d+/
];
for (const file of searchableFiles) {
  const source = await readFile(file, 'utf8');
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(source)) errors.push(`${path.relative(root, file)}: 공개 금지 연락처 또는 상세 주소가 포함되어 있습니다.`);
  }
}

if (errors.length) {
  console.error(`콘텐츠 검증 실패 (${errors.length}건)`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`콘텐츠 검증 완료: 정보 글 ${articles.length}개(${publicArticles.length}개 공개), 칼럼 ${columns.length}개(${publicColumns.length}개 공개)`);
