import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dashboard = JSON.parse(await readFile(new URL('../src/data/dashboard.json', import.meta.url), 'utf8'));
const updater = await readFile(new URL('./refresh-dashboard-data.mjs', import.meta.url), 'utf8');

test('대시보드는 6개 고유 지표와 공식 HTTPS 출처를 가진다', () => {
  assert.equal(dashboard.metrics.length, 6);
  assert.equal(new Set(dashboard.metrics.map((metric) => metric.id)).size, 6);
  assert.ok(!dashboard.metrics.some((metric) => ['usd-krw', 'fed-assets'].includes(metric.id)));
  for (const metric of dashboard.metrics) {
    assert.match(metric.source.url, /^https:\/\//);
    assert.ok(metric.source.name);
    assert.ok(metric.source.series);
    assert.ok(metric.history.length >= 4);
    assert.ok(['positive', 'negative', 'neutral'].includes(metric.direction));
    assert.ok([-1, 0, 1].includes(metric.contribution));
  }
});

test('표시 점수와 지표 기여도가 일치한다', () => {
  const score = dashboard.metrics.reduce((sum, metric) => sum + metric.contribution, 0);
  assert.equal(dashboard.score, score);
  const expected = score >= 3 ? 'favorable' : score <= -3 ? 'caution' : 'mixed';
  assert.equal(dashboard.status, expected);
});

test('스냅샷에 시점과 해석이 명시된다', () => {
  assert.ok(!Number.isNaN(Date.parse(dashboard.generatedAt)));
  assert.ok(dashboard.summary.length >= 40);
  for (const metric of dashboard.metrics) assert.match(metric.asOf, /^\d{4}-\d{2}-\d{2}$/);
});

test('전년 비교는 실행 연도에 종속되지 않는다', () => {
  assert.doesNotMatch(updater, /replace\(['"]2026['"]/);
  assert.match(updater, /shiftMonth\([^\n]+, -12\)/);
});
