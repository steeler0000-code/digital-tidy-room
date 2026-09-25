import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';

async function json(file){return JSON.parse(await readFile(file,'utf8'));}
function text(value){return String(value??'').replace(/\s+/g,' ').trim();}
function md(value){return text(value).replace(/([|*_`])/g,'\\$1');}
function host(url){return new URL(url).hostname.replace(/^www\./,'');}
function metric(value){
  if(value&&typeof value==='object') return Object.entries(value).filter(([,v])=>v!==null&&v!==''&&v!==false).map(([k,v])=>`${k}: ${v}`).join(', ');
  return text(value);
}
function kindSlug(kind){return ({foreign_flow:'foreign-flow',intraday_gainers:'intraday-gainers',weekend_research:'weekly-research'})[kind];}
function kindLabel(kind){return ({foreign_flow:'외국인 수급',intraday_gainers:'장중 급등 종목',weekend_research:'주간 심층 분석'})[kind];}
function requiredList(article,key,label){const value=article[key];if(!Array.isArray(value)||!value.some(text))throw new Error(`${label}이 없습니다.`);return value.map(text).filter(Boolean);}
function frontmatterYaml(data){return stringify(data,{lineWidth:0}).trim().replace(/^(slug|asOf): ([^\n]+)$/gm,(_,key,value)=>`${key}: ${JSON.stringify(String(value).trim())}`);}
const CLASSIFICATION_LABELS=['기본 시나리오','상방 시나리오','하방 시나리오','추적 지표','종합 해석','기업·산업 배경','가치 판단'];
const classificationLabelPattern=new RegExp(`\\s*\\[(${CLASSIFICATION_LABELS.join("|")})\\]\\s*`,"g");
export function formatClassificationLabels(value){
  return text(value).replace(classificationLabelPattern,(match,label,offset,input)=>`\n\n<strong class="analysis-classification-label">[${label}]<\/strong>${input.slice(offset+match.length).trim()&&!input.slice(offset+match.length).trim().startsWith("[")?" ":""}`).trim();
}
function analysisHighlights(stocks,synthesis){
  const values=stocks.slice(0,5).map(stock=>`${text(stock.name)} — ${metric(stock.primary_metric)}`).filter(text);
  if(values.length<2&&text(synthesis?.classification)) values.push(`분석 분류 — ${text(synthesis.classification)}`);
  if(values.length<2&&text(synthesis?.analysis)) values.push(`종합 해석 — ${text(synthesis.analysis)}`);
  return values;
}

export async function buildAnalysisPackage(packageDir,{publish=false}={}){
  const article=await json(path.join(packageDir,'article.json'));
  const kind=kindSlug(article.content_type);
  if(!kind) throw new Error('지원하지 않는 한국 시장 분석 유형입니다.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(article.publication_date||'')) throw new Error('발행일 형식이 올바르지 않습니다.');
  const stocks=Array.isArray(article.stocks)?article.stocks:[];
  if(!stocks.length) throw new Error('검증된 분석 대상이 없습니다.');
  const selectionCriteria=requiredList(article,'selection_criteria','선정 기준');
  const calculationMethod=requiredList(article,'calculation_method','계산 방법');
  const limitations=requiredList(article,'analysis_limitations','분석 한계');
  const sources=(article.sources||[]).filter(source=>source?.url?.startsWith('https://')&&text(source.title));
  if(!sources.length) throw new Error('공개 가능한 원자료가 없습니다.');
  const slug=`${article.publication_date}-${kind}`;
  const rows=stocks.map(stock=>`| ${stock.rank} | ${md(stock.name)} (${md(stock.ticker)}) | ${md(metric(stock.primary_metric))} | ${md(stock.reason)} |`).join('\n');
  const sections=stocks.map(stock=>`## ${md(stock.name)} (${md(stock.ticker)})\n\n**핵심 수치:** ${md(metric(stock.primary_metric))}\n\n### 확인된 근거\n\n${formatClassificationLabels(stock.evidence)}\n\n### 가치 판단에 연결할 점\n\n${formatClassificationLabels(stock.value_view)}\n\n### 후속 확인 항목\n\n${formatClassificationLabels(stock.outlook)}\n\n### 반대 시나리오와 위험\n\n${(stock.risks||[]).map(value=>`- ${formatClassificationLabels(value)}`).join('\n')}`).join('\n\n');
  const synthesis=article.synthesis||{};
  const body=`## 분석 대상 비교\n\n| 순위 | 종목 | 핵심 수치 | 선정 이유 |\n|---:|---|---|---|\n${rows}\n\n${sections}\n\n## 종합 해석\n\n**분류:** ${text(synthesis.classification)}\n\n${formatClassificationLabels(synthesis.analysis)}\n\n### 이후 확인할 지표\n\n${(synthesis.watch_items||[]).map(value=>`- ${formatClassificationLabels(value)}`).join('\n')}\n`;
  const frontmatter={
    title:text(article.title),description:text(article.subtitle),subtitle:text(article.executive_summary),slug,author:'카일루스',
    ...(publish?{publishedAt:article.publication_date}:{}),editorialApproved:publish,draft:!publish,featured:false,contentTier:'standard',
    summary:text(article.executive_summary),highlights:analysisHighlights(stocks,synthesis),related:[],
    sources:sources.map(source=>({title:text(source.title),url:source.url,publisher:host(source.url)})),cards:[],externalChannels:[],
    analysisKind:kind,analysisDate:article.publication_date,asOf:text(article.as_of),selectionCriteria,calculationMethod,limitations
  };
  return {slug,frontmatter,body,kindLabel:kindLabel(article.content_type)};
}

export async function writeAnalysisPackage(packageDir,siteRoot,options={}){
  const output=await buildAnalysisPackage(packageDir,options);
  const contentFile=path.join(siteRoot,'src/content/analyses',`${output.slug}.md`);
  if(!options.force){try{await access(contentFile);throw new Error(`이미 존재하는 분석입니다: ${output.slug}`);}catch(error){if(error.code!=='ENOENT')throw error;}}
  await mkdir(path.dirname(contentFile),{recursive:true});
  await writeFile(contentFile,`---\n${frontmatterYaml(output.frontmatter)}\n---\n\n${output.body}`,'utf8');
  return {...output,contentFile};
}

function parseArgs(argv){const args={publish:false,write:false,force:false,siteRoot:process.cwd()};for(let i=0;i<argv.length;i+=1){const value=argv[i];if(value==='--package-dir')args.packageDir=argv[++i];else if(value==='--site-root')args.siteRoot=argv[++i];else if(value==='--publish')args.publish=true;else if(value==='--write')args.write=true;else if(value==='--force')args.force=true;else throw new Error(`알 수 없는 인자: ${value}`);}if(!args.packageDir)throw new Error('--package-dir가 필요합니다.');return args;}
async function main(){const args=parseArgs(process.argv.slice(2));const result=args.write?await writeAnalysisPackage(args.packageDir,args.siteRoot,args):await buildAnalysisPackage(args.packageDir,args);process.stdout.write(`${JSON.stringify({slug:result.slug,draft:result.frontmatter.draft,bodyChars:result.body.length,contentFile:result.contentFile||null},null,2)}\n`);}
const invoked=process.argv[1]?path.resolve(process.argv[1]):'';if(fileURLToPath(import.meta.url)===invoked)main().catch(error=>{console.error(error.message);process.exit(1);});
