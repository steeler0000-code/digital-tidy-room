import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const dashboard = JSON.parse(await readFile(new URL('../src/data/dashboard.json', import.meta.url), 'utf8'));
const updater = await readFile(new URL('./refresh-dashboard-data.mjs', import.meta.url), 'utf8');
const execFileAsync = promisify(execFile);

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

test('CPI 지연 공표와 ECOS sample 제한을 안전하게 처리한다', () => {
  assert.match(updater, /shiftMonth\(monthNow, -20\)/);
  assert.match(updater, /monthlyWindows\(monthStart, monthNow\)/);
  assert.match(updater, /기준월 \$\{date\} 데이터 누락/);
});

test('dirty worktree stops dashboard refresh and records a Khan escalation', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'caelus-dashboard-dirty-'));
  const statePath = path.join(root, 'dashboard-state.json');
  try {
    await execFileAsync('git', ['init'], { cwd: root });
    await execFileAsync('git', ['config', 'user.email', 'test@example.invalid'], { cwd: root });
    await execFileAsync('git', ['config', 'user.name', 'Dashboard Test'], { cwd: root });
    await writeFile(path.join(root, 'tracked.md'), 'base\n');
    await execFileAsync('git', ['add', 'tracked.md'], { cwd: root });
    await execFileAsync('git', ['commit', '-m', 'base'], { cwd: root });
    await writeFile(path.join(root, 'tracked.md'), 'user change\n');
    await assert.rejects(
      execFileAsync(process.execPath, [fileURLToPath(new URL('./publish-dashboard.mjs', import.meta.url))], {
        cwd: root, env: { ...process.env, DASHBOARD_STATE_PATH: statePath, DASHBOARD_NOTIFY: '0' },
      })
    );
    const state = JSON.parse(await readFile(statePath, 'utf8'));
    assert.equal(state.status, 'blocked_dirty');
    assert.equal(state.escalation.target, 'khan');
    assert.deepEqual(state.escalation.changes, [{ status: ' M', path: 'tracked.md' }]);
    assert.equal(await readFile(path.join(root, 'tracked.md'), 'utf8'), 'user change\n');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
