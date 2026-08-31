import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import process from 'node:process';

const root = process.cwd();
const siteUrl = process.env.SITE_URL || 'https://caelus-h.com';
const snapshotPath = 'src/data/dashboard.json';

function run(command, args, capture = false) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} 실패${result.stderr ? `: ${result.stderr.trim().slice(-500)}` : ''}`);
  return result.stdout?.trim() || '';
}

async function notify(text) {
  const token = process.env.MURDOCH_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.MURDOCH_TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
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
  run('npm', ['run', 'dashboard:refresh']);
  run('npm', ['run', 'build']);
  const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
  run('git', ['add', '--', snapshotPath]);
  run('git', ['commit', '-m', `Update market dashboard ${snapshot.generatedAt.slice(0, 10)}`]);
  run('git', ['push', 'origin', 'main']);
  await verifyPublic(snapshot.generatedAt);
  await notify(`Caelus 대시보드 갱신 완료\n점수: ${snapshot.score}/8 (${snapshot.statusLabel})\n${siteUrl}/dashboard/`);
} catch (error) {
  await notify(`Caelus 대시보드 발행 실패\n${error.message}`).catch(() => {});
  console.error(error.message);
  process.exitCode = 1;
}
