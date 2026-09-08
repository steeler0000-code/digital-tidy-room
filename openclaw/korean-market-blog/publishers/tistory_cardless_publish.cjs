#!/usr/bin/env node
/* Cardless Tistory publisher. Uses the existing signed-in CDP profile. */
const http = require("http");
const fs = require("fs");
const path = require("path");

function args(argv) {
  const value = { packageDir: null, postId: "0", dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--package-dir") value.packageDir = path.resolve(argv[++i]);
    else if (argv[i] === "--post-id") value.postId = argv[++i];
    else if (argv[i] === "--dry-run") value.dryRun = true;
    else throw new Error(`알 수 없는 인자: ${argv[i]}`);
  }
  if (!value.packageDir) throw new Error("--package-dir가 필요합니다");
  return value;
}
const ARGS = args(process.argv.slice(2));

function load() {
  const articlePath = path.join(ARGS.packageDir, "article.json");
  const postPath = path.join(ARGS.packageDir, "channels", "tistory", "post.html");
  for (const file of [articlePath, postPath]) if (!fs.existsSync(file)) throw new Error(`필수 파일 없음: ${file}`);
  const article = JSON.parse(fs.readFileSync(articlePath, "utf8"));
  const content = fs.readFileSync(postPath, "utf8");
  if (/data-caelus-(image|chart)|<img\b/i.test(content)) throw new Error("카드 없는 글에 이미지 또는 자산 마커가 있습니다");
  const tags = Array.isArray(article.tags) ? article.tags.map(String).map((item) => item.trim()).filter(Boolean) : [];
  if (tags.length < 3 || tags.length > 10) throw new Error(`태그는 3~10개여야 합니다: ${tags.length}`);
  const heading = String(content.match(/<h1[^>]*>(.*?)<\/h1>/is)?.[1] || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  return { article, content, tags, title: heading || String(article.title || "").trim() };
}
const get = (url) => new Promise((resolve, reject) => http.get(url, (response) => { let data = ""; response.on("data", (chunk) => { data += chunk; }); response.on("end", () => { try { resolve(JSON.parse(data)); } catch (error) { reject(error); } }); }).on("error", reject));
function connect(url) { return new Promise((resolve, reject) => { const ws = new WebSocket(url); ws.onopen = () => resolve(ws); ws.onerror = reject; }); }
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); ws.onmessage = (event) => { const message = JSON.parse(event.data); if (message.id && this.pending.has(message.id)) { this.pending.get(message.id)(message); this.pending.delete(message.id); } }; }
  send(method, params = {}) { return new Promise((resolve) => { const id = ++this.id; this.pending.set(id, resolve); this.ws.send(JSON.stringify({ id, method, params })); }); }
  async eval(expression) { const value = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (value.exceptionDetails) throw new Error(JSON.stringify(value.exceptionDetails).slice(0, 400)); return value.result?.result?.value; }
  close() { try { this.ws.close(); } catch {} }
}
async function findExisting(cdp, title) {
  return cdp.eval(`(async () => { try { const res=await fetch('/manage/posts.json?page=1&category=-3&searchKeyword='+encodeURIComponent(${JSON.stringify(title)}),{credentials:'include'}); if(!res.ok)return null; const body=await res.json(); const list=body.items||body.posts||body.data||[]; const found=Array.isArray(list)?list.find((item)=>String(item.title||'').trim()===${JSON.stringify(title)}):null; return found?{id:String(found.id||found.postId||found.entryId||''),url:found.url||found.postUrl||null}:null; } catch(_){ return null; } })()`);
}
function output(value) { process.stdout.write(JSON.stringify(value) + "\n"); }

(async () => {
  const loaded = load();
  const title = loaded.title;
  if (!title) throw new Error("제목 누락");
  if (ARGS.dryRun) {
    output({ state: "validated", dryRun: true, title, contentChars: loaded.content.length, tagCount: loaded.tags.length, imageCount: 0 });
    return;
  }
  const tabs = await get("http://127.0.0.1:18800/json/list");
  const page = tabs.find((tab) => tab.type === "page" && tab.url.includes("caelus-k.tistory.com/manage"));
  if (!page) throw new Error("로그인된 caelus-k 관리 탭 없음");
  const cdp = new CDP(await connect(page.webSocketDebuggerUrl));
  try {
    await cdp.send("Runtime.enable");
    const login = await cdp.eval("({hasManage:location.pathname.startsWith('/manage')})");
    if (!login?.hasManage) throw new Error("티스토리 로그인 세션 만료");
    const existing = ARGS.postId === "0" ? await findExisting(cdp, title) : null;
    if (existing?.id) {
      output({ state: "published", remoteId: existing.id, url: existing.url || `https://caelus-k.tistory.com/${existing.id}`, error: null, duplicatePrevented: true });
      return;
    }
    const postId = ARGS.postId || "0";
    const endpoint = postId === "0" ? "/manage/post.json" : `/manage/post/${postId}.json`;
    const method = postId === "0" ? "POST" : "PUT";
    const payload = { id: postId, title, content: loaded.content, slogan: "", visibility: 20, category: "0", tag: loaded.tags.join(","), acceptComment: 1, published: "", password: "", thumbnail: "", type: "post", attachments: [] };
    const saved = await cdp.eval(`(async()=>{const res=await fetch(${JSON.stringify(endpoint)},{method:${JSON.stringify(method)},headers:{'Content-Type':'application/json;charset=UTF-8'},body:JSON.stringify(${JSON.stringify(payload)}),credentials:'include'});const text=await res.text();let body=null;try{body=JSON.parse(text)}catch(_){}return{ok:res.ok,status:res.status,body,raw:text.slice(0,500)}})()`);
    if (!saved?.ok) throw new Error(`저장 실패 HTTP ${saved?.status}: ${saved?.raw || ""}`);
    const body = saved.body || {};
    const entryUrl = body.entryUrl || body.url || body.postUrl || body.data?.url || "";
    const match = String(entryUrl).match(/\/(\d+)(?:$|[?#])/);
    const remoteId = String(body.id || body.postId || body.entryId || body.data?.id || (match ? match[1] : "") || postId || "");
    if (!remoteId || remoteId === "0") throw new Error("저장 결과 글 ID 누락");
    const url = entryUrl || `https://caelus-k.tistory.com/${remoteId}`;
    const verified = await cdp.eval(`(async()=>{const res=await fetch(${JSON.stringify(url)},{credentials:'include'});const text=await res.text();return{ok:res.ok,status:res.status,hasTitle:text.includes(${JSON.stringify(title)})}})()`);
    if (!verified?.ok || !verified?.hasTitle) throw new Error(`공개 URL 검증 실패: ${url}`);
    output({ state: "published", remoteId, url, error: null });
  } finally { cdp.close(); }
})().catch((error) => { console.error(error.message); process.exitCode = 2; });
