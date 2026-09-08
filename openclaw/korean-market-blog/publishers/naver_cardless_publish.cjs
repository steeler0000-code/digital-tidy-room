#!/usr/bin/env node
/* Cardless Naver SmartEditor publisher. */
const http = require("http");
const fs = require("fs");
const path = require("path");

function args(argv) {
  const value = { packageDir: null, postId: null, rebuildEditor: false, publish: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--package-dir") value.packageDir = path.resolve(argv[++i]);
    else if (argv[i] === "--post-id") value.postId = argv[++i];
    else if (argv[i] === "--rebuild-editor") value.rebuildEditor = true;
    else if (argv[i] === "--publish") value.publish = true;
    else throw new Error(`알 수 없는 인자: ${argv[i]}`);
  }
  if (!value.packageDir) throw new Error("--package-dir가 필요합니다");
  return value;
}
const ARGS = args(process.argv.slice(2));
function getJson(url) { return new Promise((resolve, reject) => http.get(url, (response) => { let data = ""; response.on("data", (chunk) => { data += chunk; }); response.on("end", () => { try { resolve(JSON.parse(data)); } catch (error) { reject(error); } }); }).on("error", reject)); }
function openJson(url) { return new Promise((resolve, reject) => { const request = http.request(url, { method: "PUT" }, (response) => { let data = ""; response.on("data", (chunk) => { data += chunk; }); response.on("end", () => { try { resolve(JSON.parse(data)); } catch (error) { reject(error); } }); }); request.on("error", reject); request.end(); }); }
function connect(url) { return new Promise((resolve, reject) => { const ws = new WebSocket(url); ws.onopen = () => resolve(ws); ws.onerror = reject; }); }
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); ws.onmessage = (event) => { const message = JSON.parse(event.data); if (message.id && this.pending.has(message.id)) { this.pending.get(message.id)(message); this.pending.delete(message.id); } }; }
  send(method, params = {}) { return new Promise((resolve) => { const id = ++this.id; this.pending.set(id, resolve); this.ws.send(JSON.stringify({ id, method, params })); }); }
  async eval(expression) {
    const value = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    const details = value.exceptionDetails || value.result?.exceptionDetails;
    if (details) throw new Error("CDP eval 실패: " + JSON.stringify(details).slice(0, 500));
    const output = value.result?.result?.value;
    if (output === undefined) throw new Error("CDP eval undefined 반환: " + JSON.stringify(value.result || {}).slice(0, 300));
    return output;
  }
  close() { try { this.ws.close(); } catch {} }
}
function loadPost() {
  const file = path.join(ARGS.packageDir, "channels", "naver", "post.md");
  const planFile = path.join(ARGS.packageDir, "channels", "naver", "plan.json");
  if (!fs.existsSync(file) || !fs.existsSync(planFile)) throw new Error(`필수 파일 없음: ${file} 또는 ${planFile}`);
  const source = fs.readFileSync(file, "utf8");
  const plan = JSON.parse(fs.readFileSync(planFile, "utf8"));
  if (/\[(IMAGE|CHART):[^\]]+\]|<img\b/i.test(source)) throw new Error("카드 없는 글에 이미지 마커가 있습니다");
  if (plan.platform !== "naver-smarteditor-one" || !Array.isArray(plan.blocks) || plan.blocks.length < 8) throw new Error("네이버 블록 계획 형식 오류");
  if ((plan.image_slots || []).length || plan.blocks.some((block) => block.type === "image")) throw new Error("카드 없는 글에 이미지 블록이 있습니다");
  const title = String(plan.blocks.find((block) => block.type === "title")?.text || "").trim();
  if (!title || source.length < 500) throw new Error("제목 누락 또는 본문 분량 부족");
  return { title, source, blocks: plan.blocks, themeName: String(plan.theme_name || "") };
}
async function findEditorPage() {
  const tabs = await getJson("http://127.0.0.1:18800/json/list");
  const current = tabs.find((tab) => tab.type === "page" && tab.url.includes("PostWriteForm.naver") && tab.url.includes("blogId=digitecher"));
  if (current) return current;
  const url = ARGS.postId ? `https://blog.naver.com/PostWriteForm.naver?blogId=digitecher&logNo=${encodeURIComponent(ARGS.postId)}&redirect=Write` : "https://blog.naver.com/PostWriteForm.naver?blogId=digitecher&Redirect=Write";
  await openJson(`http://127.0.0.1:18800/json/new?${encodeURIComponent(url)}`);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const next = await getJson("http://127.0.0.1:18800/json/list");
    const page = next.find((tab) => tab.type === "page" && tab.url.includes("PostWriteForm.naver") && tab.url.includes("blogId=digitecher"));
    if (page) return page;
  }
  throw new Error("Naver SmartEditor 탭 열기 실패");
}
async function waitForEditor(cdp) { for (let attempt = 0; attempt < 40; attempt += 1) { if (await cdp.eval("Boolean(window.SmartEditor?._editors?.blogpc001?._documentService && document.querySelector('article.se-components-wrap'))")) return; await new Promise((resolve) => setTimeout(resolve, 1000)); } throw new Error("Naver SmartEditor 로드 실패"); }
function editorExpression(title, blocks, themeName) {
  const marker = "투자 판단과 책임은 투자자 본인";
  return `(()=>{const ed=SmartEditor._editors.blogpc001;const current=structuredClone(ed._documentService.getDocumentData());const titleText=${JSON.stringify(title)};const plan=${JSON.stringify(blocks)};const themeName=${JSON.stringify(themeName)};const marker=${JSON.stringify(marker)};const palette=themeName==='teal_modern'?{theme:'#0f766e',accent:'#14b8a6',muted:'#64748b',text:'#172033',soft:'#eefdfb'}:{theme:'#0d2b52',accent:'#2f6fb0',muted:'#657086',text:'#172033',soft:'#f3f6fb'};const bodyFont='마루부리';function id(){return 'SE-'+(crypto?.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now().toString(36))}function clean(value){return String(value??'').replace(/\\r/g,'').trim()}function style(value){return Object.assign({fontFamily:bodyFont},value,{'@ctype':'nodeStyle'})}function node(value,styleValue={}){const result={id:id(),value:String(value??''),'@ctype':'textNode',style:style(styleValue)};return result}function paragraph(value,styleValue={}){return{id:id(),nodes:[node(value,styleValue)],'@ctype':'paragraph'}}function richParagraph(nodes){return{id:id(),nodes:nodes.length?nodes:[node('')],'@ctype':'paragraph'}}function textComponent(paragraphs){return{id:id(),layout:'default',value:paragraphs.length?paragraphs:[paragraph('')],'@ctype':'text'}}function lines(value){return clean(value).split(/\\n{1,}/).map((line)=>line.trim()).filter(Boolean)}function plain(value,styleValue={}){return textComponent(lines(value).map((line)=>paragraph(line,styleValue)))}function labeled(label,value,labelStyle={},bodyStyle={}){const out=[];if(clean(label))out.push(paragraph(clean(label),labelStyle));out.push(...lines(value).map((line)=>paragraph(line,bodyStyle)));return textComponent(out)}function spacer(){return textComponent([paragraph('')])}function divider(){return plain('━━━━━━━━━━━━━━━━━━━━',{fontColor:palette.accent,bold:true})}function heading(value){return plain(clean(value),{fontColor:palette.theme,bold:true,fontSizeCode:'fs24',underline:true})}function stockHeading(block){return textComponent([richParagraph([node(String(block.rank||1)+'. '+clean(block.name),{fontColor:palette.theme,bold:true,fontSizeCode:'fs36',fontSize:36}),node(' (종목코드 '+clean(block.ticker)+')',{fontColor:palette.text,fontSizeCode:'fs18'})])])}function companyProfile(block){return plain(clean(block.text),{fontColor:palette.muted,fontSizeCode:'fs15'})}function subtitle(value){return plain(clean(value),{fontColor:palette.text,fontSizeCode:'fs19'})}function quote(block){return labeled(block.label,clean(block.text),{fontColor:palette.theme,bold:true,fontSizeCode:'fs18'},{fontColor:palette.text,bold:true})}function paragraphBlock(block){return labeled(block.label,clean(block.text),{fontColor:palette.theme,bold:true},{fontColor:palette.text})}function bulletLabel(label){return richParagraph([node('• ',{fontColor:palette.accent,bold:true}),node(clean(label),{fontColor:palette.theme,bold:true})])}function field(block){const out=[bulletLabel(block.label)];out.push(...lines(block.text).map((line)=>paragraph(line,{fontColor:palette.text})));return textComponent(out)}function fieldList(block){const out=[bulletLabel(block.label)];for(const [index,item] of (Array.isArray(block.items)?block.items:[]).entries()){out.push(richParagraph([node(String(index+1)+'. ',{fontColor:palette.accent,bold:true}),node(clean(item),{fontColor:palette.text})]))}return textComponent(out)}function bullet(block){return textComponent([richParagraph([node('• ',{fontColor:palette.accent,bold:true}),node(clean(block.label)?clean(block.label)+' - ':'',{fontColor:palette.theme,bold:true}),node(clean(block.text),{fontColor:palette.text})])])}function numbered(block){return textComponent([richParagraph([node(String(block.index||1)+'. ',{fontColor:palette.accent,bold:true}),node(clean(block.text),{fontColor:palette.text})])])}function tags(block){return plain(Array.isArray(block.items)?block.items.join(' '):'',{fontColor:palette.muted,fontSizeCode:'fs13'})}function table(block){const paragraphs=[];if(clean(block.label))paragraphs.push(paragraph(clean(block.label),{fontColor:palette.theme,bold:true,fontSizeCode:'fs18'}));const headers=Array.isArray(block.headers)?block.headers:[];if(headers.length)paragraphs.push(paragraph(headers.join('  |  '),{fontColor:'#ffffff',backgroundColor:palette.theme,bold:true}));for(const row of Array.isArray(block.rows)?block.rows:[]){paragraphs.push(paragraph((Array.isArray(row)?row:[]).map(clean).join('  |  '),{fontColor:palette.text}))}return textComponent(paragraphs)}function disclaimer(block){return plain(clean(block.text),{fontColor:palette.muted,fontSizeCode:'fs13'})}function component(block){if(!block||block.type==='title')return null;if(block.type==='spacer')return spacer();if(block.type==='subtitle')return subtitle(block.text);if(block.type==='divider')return divider();if(block.type==='quote')return quote(block);if(block.type==='table')return table(block);if(block.type==='heading')return heading(block.text);if(block.type==='stock_heading')return stockHeading(block);if(block.type==='company_profile')return companyProfile(block);if(block.type==='paragraph')return paragraphBlock(block);if(block.type==='field')return field(block);if(block.type==='field_list')return fieldList(block);if(block.type==='bullet')return bullet(block);if(block.type==='numbered')return numbered(block);if(block.type==='disclaimer')return disclaimer(block);if(block.type==='tags')return tags(block);return plain((block.label?String(block.label)+'\\n':'')+clean(block.text))}const content=plan.map(component).filter(Boolean);const titleParagraph=paragraph(titleText,{fontColor:palette.theme,bold:true,fontSizeCode:'fs28'});current.document.components=[{id:id(),layout:'default',title:[titleParagraph],subTitle:null,align:'left','@ctype':'documentTitle'},...content];ed._documentService.setDocumentData(current);try{ed._documentService.setDocumentTitle(titleText)}catch(_){}return new Promise((resolve)=>{const started=Date.now();(function poll(){const root=document.querySelector('article.se-components-wrap')||document.body;const value=(root&&typeof root.innerText==='string')?root.innerText:'';const actual=ed._documentService.getDocumentData().document.components;const modelText=JSON.stringify(actual);const modelHasDisclaimer=typeof marker==='string'&&modelText.includes(marker);const hasStyledNodes=(modelText.match(/fontColor/g)||[]).length>=6;const usesBodyFont=modelText.includes(bodyFont);const stockBlocks=(plan||[]).filter((b)=>b&&b.type==='stock_heading');const stockVisible=(!stockBlocks.length)||value.includes('종목코드')||modelText.includes('종목코드');const hasLargeStockHeading=stockVisible||modelText.includes('fs36')||modelText.includes('\"fontSize\":36');const hasDisclaimerDom=value.includes(marker);if((hasDisclaimerDom&&hasStyledNodes&&usesBodyFont&&hasLargeStockHeading)||Date.now()-started>8000){resolve({title:ed._documentService.getDocumentTitle(),components:actual.length,plannedBlocks:content.length,images:root.querySelectorAll('img').length,sending:(value.match(/전송중/g)||[]).length,missing:(value.match(/존재하지 않는 이미지입니다\\./g)||[]).length,hasDisclaimer:hasDisclaimerDom||modelHasDisclaimer,hasDisclaimerDom,hasDisclaimerModel:modelHasDisclaimer,hasStyledNodes,usesBodyFont,hasLargeStockHeading});return}setTimeout(poll,150)})()})})()`;
}
async function clickByText(cdp, text) {
  const rect = await cdp.eval(`(()=>{const item=[...document.querySelectorAll('button,[role="button"]')].filter((node)=>{const r=node.getBoundingClientRect();return r.width>0&&r.height>0&&(node.innerText||node.textContent||'').trim()===${JSON.stringify(text)}}).pop();if(!item)throw new Error('버튼 없음');const r=item.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()`);
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await cdp.send("Input.dispatchMouseEvent", { type, x: rect.x, y: rect.y, button: type === "mouseMoved" ? "none" : "left", clickCount: 1 });
}
async function publishEditor(cdp, title) {
  let ready = await cdp.eval("Boolean(document.querySelector('button[data-testid=\"seOnePublishBtn\"]'))");
  if (!ready) { await clickByText(cdp, "발행"); for (let attempt = 0; attempt < 20; attempt += 1) { ready = await cdp.eval("Boolean(document.querySelector('button[data-testid=\"seOnePublishBtn\"]'))"); if (ready) break; await new Promise((resolve) => setTimeout(resolve, 500)); } }
  const clicked = await cdp.eval("(()=>{const button=document.querySelector('button[data-testid=\"seOnePublishBtn\"]');if(!button||button.disabled)return false;button.click();return true})()");
  if (!clicked) throw new Error("Naver 최종 발행 버튼 없음 또는 비활성");
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const value = await cdp.eval(`({href:location.href,hasTitle:(document.body?.innerText||'').includes(${JSON.stringify(title)})})`);
    if (String(value.href).includes("PostView.naver")) {
      const id = String(value.href).match(/logNo=(\d+)/)?.[1] || ARGS.postId || null;
      if (!id || !value.hasTitle) throw new Error("Naver 공개 페이지 제목/ID 검증 실패");
      return { state: "published", remoteId: id, url: `https://blog.naver.com/digitecher/${id}`, error: null };
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Naver 발행 완료 화면 대기 실패");
}

(async () => {
  const post = loadPost();
  if (!ARGS.publish) {
    process.stdout.write(JSON.stringify({ state: "validated", dryRun: true, title: post.title, bodyChars: post.source.length, blockCount: post.blocks.length, imageCount: 0 }) + "\n");
    return;
  }
  if (!ARGS.rebuildEditor) throw new Error("--rebuild-editor가 필요합니다");
  const page = await findEditorPage();
  const cdp = new CDP(await connect(page.webSocketDebuggerUrl));
  try {
    await waitForEditor(cdp);
    const editor = await cdp.eval(editorExpression(post.title, post.blocks, post.themeName));
    if (editor.images || editor.sending || editor.missing || !editor.hasDisclaimer || !editor.hasStyledNodes || !editor.usesBodyFont || !editor.hasLargeStockHeading || editor.title !== post.title || editor.plannedBlocks !== post.blocks.length - 1) throw new Error(`Naver 편집기 기계 검사 실패: ${JSON.stringify(editor)}`);
    const published = await publishEditor(cdp, post.title);
    process.stdout.write(JSON.stringify({ ...published, editor }) + "\n");
  } finally { cdp.close(); }
})().catch((error) => { console.error(error.message); process.exitCode = 2; });
