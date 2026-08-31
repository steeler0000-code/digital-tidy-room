import { readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const statePath = process.env.DASHBOARD_STATE_PATH || path.join(root, '.state', 'dashboard-publish.json');

function kstDate(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(value);
}

async function telegramTarget() {
  const token = process.env.MURDOCH_TELEGRAM_BOT_TOKEN;
  let chatId = process.env.MURDOCH_TELEGRAM_CHAT_ID;
  if (!chatId) {
    try {
      const config = JSON.parse(await readFile(path.join(homedir(), '.openclaw', 'openclaw.json'), 'utf8'));
      chatId = config.channels?.telegram?.accounts?.murdoch?.defaultTo;
    } catch {}
  }
  return { token, chatId };
}

let state;
try {
  state = JSON.parse(await readFile(statePath, 'utf8'));
} catch (error) {
  if (error.code === 'ENOENT') process.exit(0);
  throw error;
}

if (state.status !== 'success' || state.reported || kstDate(new Date(state.generatedAt)) !== kstDate()) process.exit(0);

const { token, chatId } = await telegramTarget();
if (!token || !chatId) throw new Error('머독 Telegram 대상 또는 토큰을 찾지 못했습니다.');

const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    chat_id: chatId,
    text: `[시스템] Caelus 대시보드 갱신 완료\n점수: ${state.score}/${state.maxScore} (${state.statusLabel})\n${state.url}`
  })
});
if (!response.ok) throw new Error(`Telegram 보고 실패: HTTP ${response.status}`);

const temp = `${statePath}.tmp`;
await writeFile(temp, `${JSON.stringify({ ...state, reported: true, reportedAt: new Date().toISOString() }, null, 2)}\n`, 'utf8');
await rename(temp, statePath);
