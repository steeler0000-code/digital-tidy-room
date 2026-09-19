import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildAnalysisPackage, writeAnalysisPackage } from './import-korean-market-analysis.mjs';

function fixture(){return {content_type:'foreign_flow',publication_date:'2026-09-19',as_of:'2026-09-18 장 마감',title:'외국인 순매수 분석',subtitle:'원자료로 확인한 수급 분석',executive_summary:'순매수 규모와 시가총액을 함께 비교했습니다.',selection_criteria:['KRX 코스피 보통주','직전 완료 거래일'],calculation_method:['순매수 금액을 시가총액과 함께 비교'],analysis_limitations:['수급은 매수 주체의 목적을 직접 설명하지 않습니다.'],stocks:[{rank:1,name:'검증기업',ticker:'000001',primary_metric:'100억원',reason:'KRX 집계에서 확인한 순매수 상위 종목입니다.',evidence:'거래소 집계와 공시를 교차 확인했습니다.',value_view:'수급과 실적을 분리해 봅니다.',outlook:'후속 수급과 실적 공시를 확인합니다.',risks:['단기 수급 반전']}],synthesis:{classification:'종목 선택형 매수',analysis:'업종 전체보다 개별 종목의 비중이 높았습니다.',watch_items:['다음 거래일 수급']},sources:[{title:'공식 원자료',url:'https://example.com/source',accessed:'2026-09-19'}]};}

test('builds a published analysis with methods and limitations',async()=>{const root=await mkdtemp(path.join(os.tmpdir(),'caelus-analysis-'));await writeFile(path.join(root,'article.json'),JSON.stringify(fixture()));const result=await buildAnalysisPackage(root,{publish:true});assert.equal(result.slug,'2026-09-19-foreign-flow');assert.equal(result.frontmatter.analysisKind,'foreign-flow');assert.equal(result.frontmatter.draft,false);assert.match(result.body,/분석 대상 비교/);});
test('fails closed without methodology',async()=>{const root=await mkdtemp(path.join(os.tmpdir(),'caelus-analysis-'));const value=fixture();delete value.calculation_method;await writeFile(path.join(root,'article.json'),JSON.stringify(value));await assert.rejects(()=>buildAnalysisPackage(root),/계산 방법/);});
test('writes the analysis collection file',async()=>{const pkg=await mkdtemp(path.join(os.tmpdir(),'caelus-analysis-pkg-'));const site=await mkdtemp(path.join(os.tmpdir(),'caelus-analysis-site-'));await mkdir(path.join(site,'src/content/analyses'),{recursive:true});await writeFile(path.join(pkg,'article.json'),JSON.stringify(fixture()));const result=await writeAnalysisPackage(pkg,site,{publish:true});assert.match(result.contentFile,/src\/content\/analyses/);});
