import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

export function dateInKst(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? markdownFiles(target) : target;
  }));
  return nested.flat().filter((file) => file.endsWith('.md'));
}

export function markAsPublished(frontmatter, publishedAt) {
  const lines = frontmatter.split(/\r?\n/);
  const nextLines = [];
  let replacedDraft = false;

  for (const line of lines) {
    if (/^scheduledAt\s*:/.test(line)) continue;
    if (/^draft\s*:/.test(line)) {
      nextLines.push(`publishedAt: ${publishedAt}`, 'draft: false');
      replacedDraft = true;
      continue;
    }
    nextLines.push(line);
  }

  if (!replacedDraft) throw new Error('예약 콘텐츠의 draft 항목을 찾을 수 없습니다.');
  return nextLines.join('\n');
}

export async function publishScheduled({ root = process.cwd(), now = new Date(), logger = console } = {}) {
  const contentRoot = path.join(root, 'src', 'content');
  const todayKst = dateInKst(now);
  const files = await markdownFiles(contentRoot);
  const published = [];

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) continue;

    const data = parse(match[1]);
    const scheduledAt = data.scheduledAt instanceof Date
      ? data.scheduledAt.toISOString().slice(0, 10)
      : String(data.scheduledAt ?? '').slice(0, 10);

    if (data.draft !== true || data.editorialApproved !== true || !scheduledAt || scheduledAt > todayKst) continue;

    const frontmatter = markAsPublished(match[1], todayKst);
    await writeFile(file, `---\n${frontmatter}\n---\n${match[2]}`, 'utf8');
    published.push(path.relative(root, file));
  }

  if (published.length) {
    logger.log(`예약 콘텐츠 ${published.length}개 공개: ${published.join(', ')}`);
  } else {
    logger.log(`오늘(${todayKst}) 공개할 승인된 예약 콘텐츠가 없습니다.`);
  }

  return { published, todayKst };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (fileURLToPath(import.meta.url) === invokedPath) await publishScheduled();
