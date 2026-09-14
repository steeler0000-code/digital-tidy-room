import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const siteUrl = process.env.SITE_URL || 'https://caelus-h.com';
const snapshotPath = 'src/data/dashboard.json';
const statePath = process.env.DASHBOARD_STATE_PATH || path.join(root, '.state', 'dashboard-publish.json');

function run(command, args, capture = false) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} 실패${result.stderr ? `: ${result.stderr.trim().slice(-500)}` : ''}`);
  // Keep porcelain's leading status column intact; trimming would turn a
  // worktree modification (` M path`) into a malformed path (`rth`).
  return result.stdout || '';
}

function trackedChangeDetails(porcelain) {
  return porcelain.split('\n').filter(Boolean).map((line) => ({
    status: line.slice(0, 2),
    path: line.slice(3).trim(),
  }));
}

class DirtyWorktreeBlockedError extends Error {
  constructor(changes) {
    super('추적 파일에 미커밋 변경이 있어 자동 갱신을 중단했습니다.');
    this.changes = changes;
  }
}

async function notify(text) {
  const token = process.env.MURDOCH_TELEGRAM_BOT_TOKEN;
  let chatId = process.env.MURDOCH_TELEGRAM_CHAT_ID;
  if (!chatId) {
    try {
      const config = JSON.parse(await readFile(path.join(homedir(), '.openclaw', 'openclaw.json'), 'utf8'));
      chatId = config.channels?.telegram?.accounts?.murdoch?.defaultTo;
    } catch {}
  }
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}

async function writeState(state) {
  await mkdir(path.dirname(statePath), { recursive: true });
  const temp = `${statePath}.tmp`;
  await writeFile(temp, `${JSON.stringify({ ...state, finishedAt: new Date().toISOString() }, null, 2)}\n`, 'utf8');
  await rename(temp, statePath);
}

async function verifyPublic(generatedAt) {
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${siteUrl}/dashboard/?snapshot=${encodeURIComponent(generatedAt)}`, { headers: { 'cache-control': 'no-cache' } });
      const html = await response.text();
      if (response.ok && html.includes(`data-dashboard-generated-at=\"${generatedAt}\"`)) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 15_000));
  }
  throw new Error('공개 대시보드에서 최신 스냅샷을 10분 안에 확인하지 못했습니다.');
}

try {
  const trackedChanges = run('git', ['status', '--porcelain', '--untracked-files=no'], true);
  if (trackedChanges) throw new DirtyWorktreeBlockedError(trackedChangeDetails(trackedChanges));
  run('git', ['fetch', 'origin', 'main']);
  run('git', ['rebase', 'origin/main']);
  run('npm', ['run', 'dashboard:refresh']);
  run('npm', ['run', 'build']);
  const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
  run('git', ['add', '--', snapshotPath]);
  run('git', ['commit', '-m', `Update market dashboard ${snapshot.generatedAt.slice(0, 10)}`]);
  run('git', ['fetch', 'origin', 'main']);
  run('git', ['rebase', 'origin/main']);
  // A recovery worktree is intentionally detached so it cannot advance the
  // source worktree containing someone else's uncommitted edits.  Push the
  // verified current commit, not that worktree's stale local `main` ref.
  run('git', ['push', 'origin', 'HEAD:main']);
  await verifyPublic(snapshot.generatedAt);
  await writeState({
    status: 'success',
    generatedAt: snapshot.generatedAt,
    score: snapshot.score,
    maxScore: snapshot.metrics.length,
    statusLabel: snapshot.statusLabel,
    url: `${siteUrl}/dashboard/`,
    reported: false
  });
} catch (error) {
  const dirtyBlocked = error instanceof DirtyWorktreeBlockedError;
  const state = dirtyBlocked
    ? {
        status: 'blocked_dirty', error: error.message, reported: true,
        escalation: {
          target: 'khan', state: 'required', reason: 'tracked_worktree_changes',
          changes: error.changes,
          nextAction: 'Preserve changes; Khan must identify authorship and choose a preservation commit or isolated worktree before retrying.',
        },
      }
    : { status: 'failed', error: error.message, reported: true };
  await writeState(state).catch(() => {});
  const notice = dirtyBlocked
    ? `[Khan 조치 요청] Caelus 대시보드 자동 갱신 중지\n${error.message}\n변경 파일: ${error.changes.map((item) => item.path).join(', ')}\n변경을 보존했습니다. reset/checkout/delete/강제 덮어쓰기는 금지이며, Khan 검토 후 보존 커밋 또는 별도 worktree 격리 여부를 결정해야 합니다.`
    : `Caelus 대시보드 발행 실패\n${error.message}`;
  await notify(notice).catch(() => {});
  console.error(error.message);
  process.exitCode = 1;
}
