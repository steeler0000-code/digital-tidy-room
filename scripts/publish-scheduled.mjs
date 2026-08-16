import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';

const root = process.cwd();
const contentRoot = path.join(root, 'src', 'content');
const todayKst = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(new Date());

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? markdownFiles(target) : target;
  }));
  return nested.flat().filter((file) => file.endsWith('.md'));
}

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

  let frontmatter = match[1];
  frontmatter = frontmatter.replace(/^draft:\s*true\s*$/m, `publishedAt: ${todayKst}\ndraft: false`);
  await writeFile(file, `---\n${frontmatter}\n---\n${match[2]}`, 'utf8');
  published.push(path.relative(root, file));
}

if (published.length) {
  console.log(`예약 콘텐츠 ${published.length}개 공개: ${published.join(', ')}`);
} else {
  console.log(`오늘(${todayKst}) 공개할 승인된 예약 콘텐츠가 없습니다.`);
}
