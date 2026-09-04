import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildBriefingPackage } from './import-caelus-package.mjs';

test('Caelus 패키지를 사이트 우선 브리핑 계약으로 변환한다', async (context) => {
  const root = path.join(os.tmpdir(), `caelus-import-${process.pid}-${Date.now()}`);
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'channels/instagram'), { recursive: true });
  const slides = Array.from({ length: 8 }, (_, index) => ({ index: index + 1, title: `카드 제목 ${index + 1}`, message: '검증된 사실과 시장 전달 경로를 충분한 길이로 설명합니다.', impact: '업종과 자산가격의 반응을 확인합니다.', watch: '공식 후속 지표와 기업 공시를 확인합니다.' }));
  await writeFile(path.join(root, 'run.json'), JSON.stringify({ date: '2026-08-31', channels: {} }));
  await writeFile(path.join(root, 'article.json'), JSON.stringify({ title: '[8/31 이슈] 첫 번째 & 두 번째 & 세 번째', usedClaimIds: ['CL-01'], imageAlt: Object.fromEntries(slides.map((_, index) => [`slide-${String(index + 1).padStart(2, '0')}`, `시장 이슈 ${index + 1}의 영향과 확인 지표를 설명하는 카드뉴스 이미지`])) }));
  await writeFile(path.join(root, 'brief.json'), JSON.stringify({ coverage_start: '2026-08-28T06:30:00+09:00', coverage_end: '2026-08-31T06:30:00+09:00', selected: { issues: ['C-01'] }, candidates: [{ id: 'C-01', market: '미국' }] }));
  await writeFile(path.join(root, 'claims.json'), JSON.stringify({ claims: [{ id: 'CL-01', status: 'verified', sources: ['https://example.com/source'] }] }));
  await writeFile(path.join(root, 'channels/instagram/manifest.json'), JSON.stringify({ slides, used_claim_ids: ['CL-01'], summary_rows: [{ issue: '첫 번째', impact: '영향', watch: '지표' }, { issue: '두 번째', impact: '영향', watch: '지표' }, { issue: '세 번째', impact: '영향', watch: '지표' }] }));
  await writeFile(path.join(root, 'master.md'), `[8/31 이슈] 제목\n\n발행 시각: 2026.08.31 08 KST\n\n도입 문장입니다. (CL-01)\n\n[IMAGE:slide-01]\n\n이슈 1: 첫 번째\n\n영향과 전망\n\n${'시장 전달 경로를 구체적으로 설명하는 문장입니다. '.repeat(55)}\n\n※ 투자 판단과 책임은 투자자 본인에게 있습니다.\n`);
  const result = await buildBriefingPackage(root, { publish: true });
  assert.equal(result.slug, '2026-08-31');
  assert.equal(result.frontmatter.title, "['26년 8월 31일 카일루스 마켓브리핑]");
  assert.equal(result.frontmatter.cards.length, 8);
  assert.equal(result.frontmatter.sources[0].url, 'https://example.com/source');
  assert.equal(result.frontmatter.draft, false);
  assert.match(result.body, /^도입 문장입니다\./);
  assert.doesNotMatch(result.body, /\[IMAGE:|CL-01/);
});
