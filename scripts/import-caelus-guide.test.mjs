import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildGuidePackage } from './import-caelus-guide.mjs';

test('심층 가이드 패키지를 사이트 스키마로 변환한다', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'caelus-guide-'));
  await mkdir(path.join(root, 'channels/instagram/cards'), { recursive: true });
  const run = {
    date: '2026-08-31', slug: 'guidance-revision-rate',
    channels: { site: { state: 'published', url: 'https://caelus-h.com/guides/guidance-revision-rate/' } }
  };
  const cards = Array.from({ length: 8 }, (_, index) => ({
    title: `카드 ${index + 1}`,
    description: '검증된 사실과 계산 순서, 해석 시 주의할 점을 충분히 설명하는 상세 문장입니다.',
    alt: `가이던스 변화율 확인 순서와 주의점을 설명하는 ${index + 1}번 카드뉴스`
  }));
  const guide = {
    title: '가이던스 변화율을 읽는 법', description: '컨센서스보다 경영진 전망의 변화를 읽습니다.',
    subtitle: '기준과 변화 폭을 구분합니다.', summary: '가이던스 변화의 방향과 폭을 확인합니다.',
    highlights: ['비교 기준을 통일합니다', '범위의 중간값만 보지 않습니다'], category: 'company-analysis',
    sources: [{ title: 'SEC', url: 'https://www.sec.gov/search-filings' }], cards,
    bodyMarkdown: '## 기준\n\n' + '사실과 해석을 구분합니다. '.repeat(150)
  };
  await writeFile(path.join(root, 'run.json'), JSON.stringify(run));
  await writeFile(path.join(root, 'guide.json'), JSON.stringify(guide));
  const output = await buildGuidePackage(root, { publish: true });
  assert.equal(output.frontmatter.cards.length, 8);
  assert.equal(output.frontmatter.externalChannels.length, 0);
  assert.equal(output.frontmatter.draft, false);
  assert.equal(output.slug, 'guidance-revision-rate');
});
