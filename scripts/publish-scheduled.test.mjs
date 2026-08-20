import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';
import { publishScheduled } from './publish-scheduled.mjs';

function frontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(match, 'YAML frontmatter가 있어야 합니다.');
  return parse(match[1]);
}

test('예약일이 지난 승인 초안을 공개 가능한 상태로 전환한다', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'scheduled-publishing-'));
  context.after(() => rm(root, { recursive: true, force: true }));

  const articles = path.join(root, 'src', 'content', 'articles');
  await mkdir(articles, { recursive: true });

  const dueFile = path.join(articles, 'due.md');
  const futureFile = path.join(articles, 'future.md');
  await writeFile(dueFile, `---
title: Due
scheduledAt: 2026-08-19
editorialApproved: true
draft: true
---
Due content.
`);
  await writeFile(futureFile, `---
title: Future
scheduledAt: 2026-08-21
editorialApproved: true
draft: true
---
Future content.
`);

  const result = await publishScheduled({
    root,
    now: new Date('2026-08-20T00:05:00Z'),
    logger: { log() {} }
  });

  assert.deepEqual(result.published, ['src/content/articles/due.md']);
  assert.equal(result.todayKst, '2026-08-20');

  const due = frontmatter(await readFile(dueFile, 'utf8'));
  assert.equal(due.draft, false);
  assert.equal(String(due.publishedAt).slice(0, 10), '2026-08-20');
  assert.equal(due.scheduledAt, undefined);
  assert.equal(due.editorialApproved, true);

  const future = frontmatter(await readFile(futureFile, 'utf8'));
  assert.equal(future.draft, true);
  assert.equal(String(future.scheduledAt).slice(0, 10), '2026-08-21');
  assert.equal(future.publishedAt, undefined);
});
