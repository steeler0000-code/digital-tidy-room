import { readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

const target = path.resolve('src/data/dashboard.json');
const output = process.argv.includes('--stdout') ? null : target;
const current = JSON.parse(await readFile(target, 'utf8'));

function rowsFromCsv(source) {
  return source.trim().split(/\r?\n/).slice(1).map((line) => line.split(','))
    .filter(([, value]) => value && value !== '.')
    .map(([date, value]) => ({ date, value: Number(value) }));
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'Caelus dashboard updater/1.0' } });
  if (!response.ok) throw new Error(`${new URL(url).hostname} HTTP ${response.status}`);
  return response.text();
}

async function fred(series) {
  return rowsFromCsv(await fetchText(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${series}`));
}

async function ecos(stat, cycle, start, end, item) {
  const key = process.env.ECOS_API_KEY || 'sample';
  const limit = key === 'sample' ? 10 : 1000;
  const url = `https://ecos.bok.or.kr/api/StatisticSearch/${encodeURIComponent(key)}/json/kr/1/${limit}/${stat}/${cycle}/${start}/${end}/${item}`;
  const parsed = JSON.parse(await fetchText(url));
  if (parsed.RESULT?.CODE === 'INFO-200') return [];
  if (!parsed.StatisticSearch?.row) throw new Error(`ECOS ${stat}: ${parsed.RESULT?.MESSAGE || '응답 형식 오류'}`);
  return parsed.StatisticSearch.row.map((row) => ({
    date: cycle === 'M' ? `${row.TIME.slice(0, 4)}-${row.TIME.slice(4, 6)}-01` : `${row.TIME.slice(0, 4)}-${row.TIME.slice(4, 6)}-${row.TIME.slice(6, 8)}`,
    value: Number(row.DATA_VALUE)
  }));
}

function dateInKst(offsetDays = 0) {
  const now = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

const compactDay = (value) => value.replaceAll('-', '');
const compactMonth = (value) => value.slice(0, 7).replace('-', '');

function shiftMonth(value, offset) {
  const [year, month] = value.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

async function ecosDailyHistory(stat, item, days = 98) {
  const rows = [];
  for (let offset = -days; offset <= 0; offset += 7) {
    const start = dateInKst(offset);
    const end = dateInKst(Math.min(offset + 6, 0));
    rows.push(...await ecos(stat, 'D', compactDay(start), compactDay(end), item));
  }
  return [...new Map(rows.map((row) => [row.date, row])).values()].sort((a, b) => a.date.localeCompare(b.date));
}

const round = (value, digits = 2) => Number(value.toFixed(digits));
const pct = (value, base) => ((value / base) - 1) * 100;
const latest = (rows) => rows.at(-1);
const findDate = (rows, date) => rows.find((row) => row.date === date);
const metric = (id) => current.metrics.find((item) => item.id === id);
const set = (id, values) => Object.assign(metric(id), values);

function kstTimestamp() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date()).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+09:00`;
}

async function refresh() {
  const monthNow = `${dateInKst().slice(0, 7)}-01`;
  const monthStart = shiftMonth(monthNow, -16);
  const monthSplit = shiftMonth(monthStart, 8);
  const monthSplitNext = shiftMonth(monthStart, 9);
  const [dgs10, dgs2, m2sl, walcl, krRate, krFx, krCpi] = await Promise.all([
    fred('DGS10'), fred('DGS2'), fred('M2SL'), fred('WALCL'),
    ecosDailyHistory('722Y001', '0101000'),
    ecosDailyHistory('731Y001', '0000001'),
    Promise.all([
      ecos('901Y009', 'M', compactMonth(monthStart), compactMonth(monthSplit), '0'),
      ecos('901Y009', 'M', compactMonth(monthSplitNext), compactMonth(monthNow), '0')
    ]).then((parts) => parts.flat())
  ]);

  const rateNow = latest(krRate);
  const rateReferenceDate = new Date(`${rateNow.date}T00:00:00+09:00`);
  rateReferenceDate.setMonth(rateReferenceDate.getMonth() - 3);
  const rateReferenceTarget = rateReferenceDate.toISOString().slice(0, 10);
  const rateReference = [...krRate].reverse().find((row) => row.date <= rateReferenceTarget)?.value ?? krRate[0].value;
  const rateDelta = rateNow.value - rateReference;
  set('kr-base-rate', {
    value: rateNow.value, displayValue: `${rateNow.value.toFixed(2)}%`, asOf: rateNow.date,
    changeLabel: `3개월 전 대비 ${rateDelta >= 0 ? '+' : ''}${rateDelta.toFixed(2)}%p`,
    contribution: rateDelta >= .25 ? -1 : rateDelta <= -.25 ? 1 : 0,
    direction: rateDelta > 0 ? 'negative' : rateDelta < 0 ? 'positive' : 'neutral',
    history: [rateReference, rateReference, rateReference, rateNow.value]
  });

  const fxNow = latest(krFx);
  const fxRows = krFx.slice(-60);
  const fxValues = fxRows.map((row) => row.value);
  const fxReference = [...fxValues].sort((a, b) => a - b)[Math.floor(fxValues.length / 2)];
  const fxDelta = pct(fxNow.value, fxReference);
  set('usd-krw', {
    value: fxNow.value, displayValue: `${fxNow.value.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}원`, asOf: fxNow.date,
    changeLabel: `60거래일 중앙값 대비 ${fxDelta >= 0 ? '+' : ''}${fxDelta.toFixed(1)}%`,
    contribution: fxDelta >= 2 ? -1 : fxDelta <= -2 ? 1 : 0,
    direction: fxDelta > 0 ? 'negative' : fxDelta < 0 ? 'positive' : 'neutral', history: fxValues.slice(-10)
  });

  const cpiNowIndex = latest(krCpi);
  const cpiPrior = findDate(krCpi, cpiNowIndex.date.replace('2026', '2025'));
  const cpiYoy = pct(cpiNowIndex.value, cpiPrior.value);
  const cpiReferenceDate = shiftMonth(cpiNowIndex.date, -3);
  const cpiReference = pct(findDate(krCpi, cpiReferenceDate).value, findDate(krCpi, shiftMonth(cpiReferenceDate, -12)).value);
  const cpiDelta = cpiYoy - cpiReference;
  set('kr-cpi', {
    value: round(cpiYoy), displayValue: `${cpiYoy.toFixed(1)}%`, asOf: cpiNowIndex.date,
    contribution: cpiDelta >= .3 ? -1 : cpiDelta <= -.3 ? 1 : 0,
    direction: cpiDelta > 0 ? 'negative' : cpiDelta < 0 ? 'positive' : 'neutral'
  });

  const ten = latest(dgs10); const two = latest(dgs2);
  const tenRef = dgs10.at(-61); const twoRef = dgs2.at(-61);
  const tenDelta = ten.value - tenRef.value;
  set('us-10y', {
    value: ten.value, displayValue: `${ten.value.toFixed(2)}%`, asOf: ten.date,
    changeLabel: `60거래일 전 대비 ${tenDelta >= 0 ? '+' : ''}${tenDelta.toFixed(2)}%p`,
    contribution: tenDelta >= .25 ? -1 : tenDelta <= -.25 ? 1 : 0,
    direction: tenDelta > 0 ? 'negative' : tenDelta < 0 ? 'positive' : 'neutral', history: dgs10.slice(-10).map((row) => row.value)
  });

  const spread = ten.value - two.value; const spreadRef = tenRef.value - twoRef.value; const spreadDelta = spread - spreadRef;
  set('us-yield-spread', {
    value: round(spread), displayValue: `${spread >= 0 ? '+' : ''}${spread.toFixed(2)}%p`, asOf: ten.date,
    changeLabel: `60거래일 전 대비 ${spreadDelta >= 0 ? '+' : ''}${spreadDelta.toFixed(2)}%p`,
    contribution: spreadDelta >= .25 ? 1 : spreadDelta <= -.25 ? -1 : 0,
    direction: spreadDelta > 0 ? 'positive' : spreadDelta < 0 ? 'negative' : 'neutral',
    history: dgs10.slice(-10).map((row, index) => round(row.value - dgs2.slice(-10)[index].value))
  });

  const m2Now = latest(m2sl); const m2Prior = findDate(m2sl, m2Now.date.replace('2026', '2025'));
  const m2ThreeMonths = m2sl.at(-4); const m2ThreePrior = findDate(m2sl, m2ThreeMonths.date.replace('2026', '2025'));
  const m2Yoy = pct(m2Now.value, m2Prior.value); const m2YoyRef = pct(m2ThreeMonths.value, m2ThreePrior.value); const m2Delta = m2Yoy - m2YoyRef;
  set('us-m2', {
    value: round(m2Yoy), displayValue: `${m2Yoy.toFixed(1)}%`, asOf: m2Now.date,
    changeLabel: `3개월 전 대비 ${m2Delta >= 0 ? '+' : ''}${m2Delta.toFixed(2)}%p`,
    contribution: m2Delta >= .5 ? 1 : m2Delta <= -.5 ? -1 : 0,
    direction: m2Delta > 0 ? 'positive' : m2Delta < 0 ? 'negative' : 'neutral'
  });

  const fedNow = latest(walcl); const fedRef = walcl.at(-14); const fedDelta = pct(fedNow.value, fedRef.value);
  set('fed-assets', {
    value: round(fedDelta, 1), displayValue: `${fedDelta >= 0 ? '+' : ''}${fedDelta.toFixed(1)}%`, asOf: fedNow.date,
    contribution: fedDelta >= 1 ? 1 : fedDelta <= -1 ? -1 : 0,
    direction: fedDelta > 0 ? 'positive' : fedDelta < 0 ? 'negative' : 'neutral', history: walcl.slice(-10).map((row) => row.value)
  });

  try {
    const bokHtml = await fetchText('https://www.bok.or.kr/portal/main/main.do');
    const bokText = bokHtml.replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ');
    const release = bokText.match(/(20\d{2})년\s*(\d{1,2})월\s*통화\s*및\s*유동성[\s\S]{0,500}?M2[\s\S]{0,500}?전년동월대비\s*\+?([\d.]+)%/);
    if (release) {
      const krM2 = metric('kr-m2');
      const value = Number(release[3]);
      const asOf = `${release[1]}-${String(release[2]).padStart(2, '0')}-01`;
      const history = krM2.asOf === asOf ? krM2.history : [...krM2.history, value].slice(-4);
      const delta = value - history[0];
      set('kr-m2', {
        value, displayValue: `${value.toFixed(1)}%`, asOf, history,
        contribution: delta >= .5 ? 1 : delta <= -.5 ? -1 : 0,
        direction: delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral'
      });
    }
  } catch {
    // 보도자료 페이지 일시 오류는 다른 지표 갱신을 막지 않고 직전 검증값을 유지한다.
  }
  current.score = current.metrics.reduce((sum, item) => sum + item.contribution, 0);
  current.status = current.score >= 3 ? 'favorable' : current.score <= -3 ? 'caution' : 'mixed';
  current.statusLabel = current.status === 'favorable' ? '우호' : current.status === 'caution' ? '경계' : '혼조';
  const contributionGroups = [
    { label: '금리', ids: ['kr-base-rate', 'us-10y', 'us-yield-spread'] },
    { label: '물가·환율', ids: ['usd-krw', 'kr-cpi'] },
    { label: '유동성', ids: ['kr-m2', 'us-m2', 'fed-assets'] }
  ];
  current.contributions = contributionGroups.map((group) => ({
    label: group.label,
    score: current.metrics.filter((item) => group.ids.includes(item.id)).reduce((sum, item) => sum + item.contribution, 0)
  }));
  current.summary = current.status === 'favorable'
    ? '금리·환율·물가·유동성 지표 중 우호한 변화가 더 많습니다. 다만 이 점수는 매매 신호가 아니며 개별 자산의 평가가치와 실적을 별도로 확인해야 합니다.'
    : current.status === 'caution'
      ? '금리·환율·물가·유동성 지표 중 부담 방향의 변화가 더 많습니다. 특정 자산의 즉시 매도 신호로 해석하지 않고 다음 공표와 실적을 확인합니다.'
      : '금리·환율·물가·유동성 지표가 한 방향을 가리키지 않습니다. 단일 지표를 매매 신호로 삼기보다 다음 공표에서 방향이 확인되는지 점검할 구간입니다.';
  current.generatedAt = kstTimestamp();
  return current;
}

async function notifyFailure(error) {
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
    body: JSON.stringify({ chat_id: chatId, text: `Caelus 대시보드 갱신 실패: ${error.message}` })
  });
}

try {
  const refreshed = await refresh();
  const serialized = `${JSON.stringify(refreshed, null, 2)}\n`;
  if (!output) process.stdout.write(serialized);
  else {
    const temp = `${output}.tmp`;
    await writeFile(temp, serialized, 'utf8');
    await rename(temp, output);
    console.log(`대시보드 갱신 완료: ${refreshed.generatedAt}, 점수 ${refreshed.score}`);
  }
} catch (error) {
  await notifyFailure(error).catch(() => {});
  console.error(`대시보드 갱신 실패: ${error.stack || error.message}`);
  process.exitCode = 1;
}
