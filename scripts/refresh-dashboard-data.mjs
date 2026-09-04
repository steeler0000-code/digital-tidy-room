import { readFile, rename, writeFile } from 'node:fs/promises';
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

function monthlyWindows(start, end, monthsPerWindow = 9) {
  const windows = [];
  for (let cursor = start; cursor <= end; cursor = shiftMonth(cursor, monthsPerWindow)) {
    const candidateEnd = shiftMonth(cursor, monthsPerWindow - 1);
    windows.push([cursor, candidateEnd < end ? candidateEnd : end]);
  }
  return windows;
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
const latest = (rows) => (Array.isArray(rows) && rows.length > 0 ? rows.at(-1) : null);
const findDate = (rows, date) => rows.find((row) => row.date === date);
function requireDate(rows, date, label) {
  const row = findDate(rows, date);
  if (!row || !Number.isFinite(row.value)) throw new Error(`${label}: 기준월 ${date} 데이터 누락`);
  return row;
}
function metric(id) {
  const found = current.metrics.find((item) => item.id === id);
  if (!found) throw new Error(`dashboard.json: 지표 ${id} 누락`);
  return found;
}
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
  // 최신 CPI가 1~2개월 늦게 공표되어도 "3개월 전의 전년동월"을
  // 계산할 수 있도록 20개월을 확보한다. ECOS sample 키의 10행 제한을
  // 넘지 않도록 9개월 단위로 나눠 조회한다.
  const monthStart = shiftMonth(monthNow, -20);
  const [dgs10, dgs2, m2sl, krRate, krCpi] = await Promise.all([
    fred('DGS10'), fred('DGS2'), fred('M2SL'),
    ecosDailyHistory('722Y001', '0101000'),
    Promise.all(monthlyWindows(monthStart, monthNow).map(([start, end]) =>
      ecos('901Y009', 'M', compactMonth(start), compactMonth(end), '0')
    )).then((parts) => parts.flat())
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

  const cpiNowIndex = latest(krCpi);
  if (!cpiNowIndex) throw new Error('한국 CPI: 최신 데이터 없음');
  const cpiPrior = requireDate(krCpi, shiftMonth(cpiNowIndex.date, -12), '한국 CPI 전년 비교');
  const cpiYoy = pct(cpiNowIndex.value, cpiPrior.value);
  const cpiReferenceDate = shiftMonth(cpiNowIndex.date, -3);
  const cpiReference = pct(
    requireDate(krCpi, cpiReferenceDate, '한국 CPI 3개월 비교').value,
    requireDate(krCpi, shiftMonth(cpiReferenceDate, -12), '한국 CPI 3개월 전년 비교').value
  );
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

  const m2Now = latest(m2sl);
  if (!m2Now) throw new Error('미국 M2: 최신 데이터 없음');
  const m2Prior = requireDate(m2sl, shiftMonth(m2Now.date, -12), '미국 M2 전년 비교');
  const m2ThreeMonths = m2sl.at(-4);
  if (!m2ThreeMonths) throw new Error('미국 M2: 3개월 비교 데이터 부족');
  const m2ThreePrior = requireDate(m2sl, shiftMonth(m2ThreeMonths.date, -12), '미국 M2 3개월 전년 비교');
  const m2Yoy = pct(m2Now.value, m2Prior.value); const m2YoyRef = pct(m2ThreeMonths.value, m2ThreePrior.value); const m2Delta = m2Yoy - m2YoyRef;
  set('us-m2', {
    value: round(m2Yoy), displayValue: `${m2Yoy.toFixed(1)}%`, asOf: m2Now.date,
    changeLabel: `3개월 전 대비 ${m2Delta >= 0 ? '+' : ''}${m2Delta.toFixed(2)}%p`,
    contribution: m2Delta >= .5 ? 1 : m2Delta <= -.5 ? -1 : 0,
    direction: m2Delta > 0 ? 'positive' : m2Delta < 0 ? 'negative' : 'neutral'
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
    { label: '물가', ids: ['kr-cpi'] },
    { label: '유동성', ids: ['kr-m2', 'us-m2'] }
  ];
  current.contributions = contributionGroups.map((group) => ({
    label: group.label,
    score: current.metrics.filter((item) => group.ids.includes(item.id)).reduce((sum, item) => sum + item.contribution, 0)
  }));
  current.summary = current.status === 'favorable'
    ? '금리·물가·유동성 지표 중 우호한 변화가 더 많습니다. 다만 이 점수는 매매 신호가 아니며 개별 자산의 평가가치와 실적을 별도로 확인해야 합니다.'
    : current.status === 'caution'
      ? '금리·물가·유동성 지표 중 부담 방향의 변화가 더 많습니다. 특정 자산의 즉시 매도 신호로 해석하지 않고 다음 공표와 실적을 확인합니다.'
      : '금리·물가·유동성 지표가 한 방향을 가리키지 않습니다. 단일 지표를 매매 신호로 삼기보다 다음 공표에서 방향이 확인되는지 점검할 구간입니다.';
  current.generatedAt = kstTimestamp();
  return current;
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
  console.error(`대시보드 갱신 실패: ${error.stack || error.message}`);
  process.exitCode = 1;
}
