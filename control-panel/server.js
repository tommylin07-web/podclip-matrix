#!/usr/bin/env node
/* PodClip Matrix · 本地控制台
 * 零依赖 Node 网页：转写、渲染、逐平台发布、登录、看日志，全在浏览器点。
 * 跑法： node control-panel/server.js   然后浏览器开 http://localhost:8787
 * 配置(环境变量): SAU_ACCOUNT(默认 default) SAU_DIR(默认 ~/social-auto-upload) PORT(默认 8787)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');                 // 仓库根目录
const HOME = process.env.HOME;
const SAU_DIR = process.env.SAU_DIR || `${HOME}/social-auto-upload`;
const SAU = `${SAU_DIR}/.venv/bin/sau`;
const ACCOUNT = process.env.SAU_ACCOUNT || 'default';
const MATRIX = path.join(ROOT, 'matrix');
const TRANS = path.join(ROOT, 'data', 'transcripts');
const LOGS = path.join(ROOT, 'logs');
const PORT = parseInt(process.env.PORT) || 8787;
fs.mkdirSync(LOGS, { recursive: true });

const LOG_FILES = {
  transcribe: path.join(LOGS, 'transcribe.log'),
  daily: path.join(LOGS, 'matrix-daily.log'),
  publish: path.join(LOGS, 'control-publish.log'),
  login: path.join(LOGS, 'control-login.log'),
  render: path.join(LOGS, 'render.log'),
};
function cutsReady() {
  try {
    return fs.readdirSync(path.join(MATRIX, 'cuts'))
      .map(f => (f.match(/^ep(\d+)\.jsonl$/) || [])[1]).filter(Boolean).map(Number).sort((a, b) => b - a);
  } catch { return []; }
}
// Logo：优先用 control-panel/logo.png，否则用 clipper/public/logo.png
function logoPath() {
  const c = [path.join(__dirname, 'logo.png'), path.join(ROOT, 'clipper', 'public', 'logo.png')];
  for (const f of c) { try { if (fs.statSync(f).isFile()) return f; } catch {} }
  return null;
}

// ---- 工具 ----
function readJSONL(file) {
  try {
    return fs.readFileSync(file, 'utf8').split('\n')
      .map(l => l.trim()).filter(l => l && !l.startsWith('#'))
      .map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}
function tail(file, n = 120) {
  try {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    return lines.slice(-n).join('\n').replace(/\x1b\[[0-9;]*m/g, '');
  } catch { return '(暂无日志)'; }
}
function transcribedEpisodes() {
  try {
    return fs.readdirSync(TRANS).map(f => (f.match(/^ep(\d+)\.json$/) || [])[1])
      .filter(Boolean).map(Number).sort((a, b) => b - a);
  } catch { return []; }
}
function runJob(cmd, logKey, banner) {
  const fd = fs.openSync(LOG_FILES[logKey], 'a');
  fs.writeSync(fd, `\n===== ${banner} @ ${new Date().toLocaleString()} =====\n`);
  const child = spawn('bash', ['-lc', cmd], { cwd: ROOT, detached: true, stdio: ['ignore', fd, fd] });
  child.unref();
  return child.pid;
}
function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type + '; charset=utf-8' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}
function readBody(req) {
  return new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => { try { r(JSON.parse(d || '{}')); } catch { r({}); } }); });
}

// ---- 路由 ----
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'GET' && u.pathname === '/') return send(res, 200, HTML, 'text/html');

  if (req.method === 'GET' && u.pathname === '/logo') {
    const p = logoPath();
    if (!p) return send(res, 404, 'no logo', 'text/plain');
    res.writeHead(200, { 'Content-Type': p.endsWith('.svg') ? 'image/svg+xml' : 'image/png', 'Cache-Control': 'no-cache' });
    return fs.createReadStream(p).pipe(res);
  }

  if (u.pathname === '/api/status') {
    let schedule = '';
    try { schedule = fs.readFileSync(path.join(MATRIX, 'schedule.txt'), 'utf8').split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).join('\n'); } catch {}
    let pubStatus = {};
    try { pubStatus = JSON.parse(fs.readFileSync(path.join(MATRIX, 'publish_status.json'), 'utf8')); } catch {}
    return send(res, 200, {
      transcribed: transcribedEpisodes(),
      pending: readJSONL(path.join(MATRIX, 'clips.jsonl')),
      published: readJSONL(path.join(MATRIX, 'clips_published.jsonl')),
      pubStatus, schedule: schedule || '(排期为空)', cutsReady: cutsReady(),
      logs: { transcribe: tail(LOG_FILES.transcribe, 40), daily: tail(LOG_FILES.daily, 60), publish: tail(LOG_FILES.publish, 60), login: tail(LOG_FILES.login, 30), render: tail(LOG_FILES.render, 60) },
    });
  }

  if (u.pathname === '/api/log') {
    const name = u.searchParams.get('name');
    if (!LOG_FILES[name]) return send(res, 400, { error: 'bad log' });
    return send(res, 200, { text: tail(LOG_FILES[name], 300) });
  }

  if (req.method === 'POST' && u.pathname === '/api/transcribe') {
    const { count } = await readBody(req);
    const n = Math.max(1, Math.min(50, parseInt(count) || 5));
    const pid = runJob(`bash ${ROOT}/transcribe.sh ${n}`, 'transcribe', `转写最新 ${n} 期`);
    return send(res, 200, { ok: true, pid, msg: `已开始转写最新 ${n} 期（需自备 transcribe.sh），看「转写」日志` });
  }

  if (req.method === 'POST' && u.pathname === '/api/restart') {
    send(res, 200, { ok: true, msg: '控制台重启中…约 2 秒后自动刷新' });
    setTimeout(() => { try { server.close(() => { const c = spawn(process.execPath, [__filename], { detached: true, stdio: 'inherit' }); c.unref(); process.exit(0); }); } catch { process.exit(0); } }, 200);
    return;
  }

  if (req.method === 'POST' && u.pathname === '/api/runnow') {
    const pid = runJob(`bash ${MATRIX}/daily_run.sh`, 'daily', '手动触发：立即运行每日任务（渲染+发布）');
    return send(res, 200, { ok: true, pid, msg: '已开始：自动渲染待出片 + 自动发布。看「每日发布」日志' });
  }

  if (req.method === 'POST' && u.pathname === '/api/serverchan-key') {
    const { key } = await readBody(req);
    const k = String(key || '').trim().replace(/[^A-Za-z0-9]/g, '');
    if (!k) return send(res, 400, { error: 'key 为空' });
    try { fs.writeFileSync(path.join(MATRIX, 'serverchan.key'), k); } catch (e) { return send(res, 500, { error: String(e) }); }
    return send(res, 200, { ok: true, msg: '微信推送 SENDKEY 已保存' });
  }

  if (req.method === 'POST' && u.pathname === '/api/render') {
    const { ep } = await readBody(req);
    const e = parseInt(ep);
    if (!e) return send(res, 400, { error: 'bad ep' });
    const pid = runJob(`bash ${MATRIX}/render_clips.sh ${e}`, 'render', `渲染 EP${e} 切片`);
    return send(res, 200, { ok: true, pid, msg: `已开始渲染 EP${e}，看「渲染」日志；完成后进待发列表` });
  }

  if (req.method === 'POST' && u.pathname === '/api/publish') {
    const { id, platforms } = await readBody(req);
    if (!id || !platforms) return send(res, 400, { error: '缺 id/platforms' });
    const safeId = String(id).replace(/[^A-Za-z0-9_\-]/g, '');
    const safe = String(platforms).replace(/[^a-z,]/g, '');
    // 手动点某平台是明确意图（发/重试/重发），用 FORCE=1 绕过"已成功则跳过"的幂等保护。
    const pid = runJob(`FORCE=1 bash ${MATRIX}/publish_matrix.sh ${safeId} ${safe}`, 'publish', `发布 ${safeId} → ${safe}`);
    return send(res, 200, { ok: true, pid, msg: `已开始发布 ${safeId} → ${safe}，看「手动发布」日志` });
  }

  if (req.method === 'POST' && u.pathname === '/api/login') {
    const { platform } = await readBody(req);
    const p = String(platform).replace(/[^a-z]/g, '');
    if (!p) return send(res, 400, { error: 'bad platform' });
    const headed = (p === 'tencent') ? ' --headed' : '';
    const pid = runJob(`${SAU} ${p} login --account ${ACCOUNT}${headed}`, 'login', `登录 ${p}`);
    return send(res, 200, { ok: true, pid, msg: `已唤起 ${p} 登录，请扫码` });
  }

  send(res, 404, { error: 'not found' });
});
server.listen(PORT, '127.0.0.1', () => console.log(`\n🎬 PodClip Matrix 控制台已启动 → http://localhost:${PORT}\n（按 Ctrl-C 关闭）`));

// ---- 前端页面 ----
const HTML = `<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PodClip Matrix · 控制台</title><style>
:root{--bg:#0f0f10;--card:#1b1b1d;--line:#2c2c30;--y:#5b8cff;--mut:#9a9aa0;--txt:#f0f0f2}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font:15px/1.5 -apple-system,"PingFang SC",sans-serif}
header{background:linear-gradient(90deg,#1b1b1d,#111);border-bottom:2px solid var(--y);padding:14px 22px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:9}
header h1{font-size:18px;margin:0}
.wrap{max-width:1080px;margin:0 auto;padding:20px}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}
.stat{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px}
.stat b{font-size:26px;color:var(--y)}.stat span{color:var(--mut);font-size:13px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px;margin-bottom:18px}
.card h2{margin:0 0 12px;font-size:16px}.card h2 small{color:var(--mut);font-weight:400;font-size:12px}
button{background:var(--y);color:#181818;border:0;border-radius:9px;padding:9px 16px;font-weight:700;cursor:pointer;font-size:14px}
button:hover{background:#ffd84a}button.ghost{background:#2a2a2e;color:var(--txt)}button.ghost:hover{background:#34343a}
input[type=number]{width:64px;background:#0e0e10;border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:8px}
table{width:100%;border-collapse:collapse}td,th{padding:9px 8px;border-bottom:1px solid var(--line);text-align:left;font-size:14px;vertical-align:top}
th{color:var(--mut);font-weight:600}.tag{display:inline-block;background:#2a2a2e;border-radius:6px;padding:1px 7px;margin:1px;font-size:12px;color:var(--mut)}
pre{background:#0a0a0b;border:1px solid var(--line);border-radius:10px;padding:12px;max-height:300px;overflow:auto;font:12px/1.45 ui-monospace,Menlo,monospace;color:#cdd0d4;white-space:pre-wrap}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.mut{color:var(--mut)}.toast{position:fixed;right:18px;bottom:18px;background:#222;border:1px solid var(--y);border-radius:10px;padding:12px 16px;max-width:340px;display:none}
.tabs button{background:#2a2a2e;color:var(--mut);margin-right:6px;padding:6px 12px;font-weight:600}.tabs button.on{background:var(--y);color:#181818}
.empty{color:var(--mut);padding:10px 0}
</style></head><body>
<header><img src="/logo" alt="logo" style="height:34px;width:auto;border-radius:8px" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'🎬',style:'font-size:24px'}))"><h1>PodClip Matrix · 控制台</h1><span style="margin-left:auto" class="row"><button style="padding:5px 14px" onclick="runNow()">▶ 立即运行</button><button class="ghost" style="padding:5px 12px" onclick="restart()">🔄 重启</button><span class="mut" id="clock"></span></span></header>
<div class="wrap">
  <div class="cards">
    <div class="stat"><b id="s-trans">–</b><br><span>已转写期数</span></div>
    <div class="stat"><b id="s-pending">–</b><br><span>待发切片</span></div>
    <div class="stat"><b id="s-pub">–</b><br><span>已发切片</span></div>
    <div class="stat"><b id="s-sched">–</b><br><span>排期条数</span></div>
  </div>
  <div class="card"><h2>① 转写新节目 <small>需自备 transcribe.sh</small></h2>
    <div class="row">转写最新 <input type="number" id="n" value="5" min="1" max="50"> 期 <button onclick="transcribe()">开始转写</button>
      <span class="mut">已转写：<span id="trans-list">–</span></span></div></div>
  <div class="card"><h2>② 切片渲染 <small>整期 → mp4+封面</small></h2>
    <div class="row" id="cuts"><span class="mut">加载中…</span></div>
    <div class="row" style="margin-top:8px">手动渲染：EP<input type="number" id="ren" placeholder="12" style="width:74px"> <button onclick="renderEp()">渲染</button>
      <span class="mut">（先在 matrix/cuts/ep&lt;N&gt;.jsonl 定义片段）</span></div></div>
  <div class="card"><h2>③ 待发切片 <small>逐平台发布；封面/原创自动带</small></h2><div id="pending"></div></div>
  <div class="card"><h2>④ 平台登录 / 提醒 <small>cookie 过期时点登录扫码</small></h2>
    <div class="row">
      <button class="ghost" onclick="login('douyin')">登录抖音</button>
      <button class="ghost" onclick="login('xiaohongshu')">登录小红书</button>
      <button class="ghost" onclick="login('tencent')">登录视频号</button>
      <button class="ghost" onclick="login('youtube')">登录YouTube</button></div>
    <div class="row" style="margin-top:10px">微信推送(Server酱) SENDKEY：<input id="sckey" placeholder="sct.ftqq.com 扫码后的 key" style="flex:1;min-width:240px;background:#0e0e10;border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:8px">
      <button class="ghost" onclick="saveKey()">保存</button></div></div>
  <div class="card"><h2>⑤ 日志</h2>
    <div class="tabs" id="tabs">
      <button class="on" data-k="daily" onclick="tab('daily')">每日发布</button>
      <button data-k="publish" onclick="tab('publish')">手动发布</button>
      <button data-k="render" onclick="tab('render')">渲染</button>
      <button data-k="transcribe" onclick="tab('transcribe')">转写</button>
      <button data-k="login" onclick="tab('login')">登录</button></div>
    <pre id="log">加载中…</pre></div>
  <div class="card"><h2>⑥ 已发切片 <button class="ghost" style="float:right;padding:4px 10px" onclick="togPub()">展开/收起</button></h2><div id="published" style="display:none"></div></div>
</div>
<div class="toast" id="toast"></div>
<script>
let CUR='daily', DATA=null;
const PLATS=[['xiaohongshu','小红书'],['weixin','视频号'],['youtube','YouTube'],['douyin','抖音']];
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.style.display='block';clearTimeout(t._);t._=setTimeout(()=>t.style.display='none',4000);}
async function load(){
  const r=await fetch('/api/status');DATA=await r.json();
  document.getElementById('s-trans').textContent=DATA.transcribed.length;
  document.getElementById('s-pending').textContent=DATA.pending.length;
  document.getElementById('s-pub').textContent=DATA.published.length;
  document.getElementById('s-sched').textContent=(DATA.schedule&&DATA.schedule!=='(排期为空)')?DATA.schedule.split('\\n').length:0;
  document.getElementById('trans-list').textContent=DATA.transcribed.length?('EP'+DATA.transcribed.join(', EP')):'无';
  renderCuts();renderPending();renderPub();renderLog();
}
function renderCuts(){const el=document.getElementById('cuts');
  if(!DATA.cutsReady||!DATA.cutsReady.length){el.innerHTML='<span class="mut">暂无切片定义。在 matrix/cuts/ep&lt;N&gt;.jsonl 定义片段后，这里出现一键渲染按钮。</span>';return;}
  el.innerHTML='可一键渲染：'+DATA.cutsReady.map(e=>'<button class="ghost" style="margin:2px" onclick="render('+e+')">渲染 EP'+e+'</button>').join('');}
async function render(ep){const r=await fetch('/api/render',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ep})});const j=await r.json();toast(j.msg||j.error);CUR='render';tab('render');}
function renderEp(){const v=document.getElementById('ren').value;if(v)render(parseInt(v));}
async function restart(){toast('控制台重启中…');try{await fetch('/api/restart',{method:'POST'});}catch{}setTimeout(()=>location.reload(),2500);}
async function runNow(){const r=await fetch('/api/runnow',{method:'POST'});const j=await r.json();toast(j.msg||j.error);CUR='daily';tab('daily');}
async function saveKey(){const key=document.getElementById('sckey').value;const r=await fetch('/api/serverchan-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key})});const j=await r.json();toast(j.msg||j.error);}
function statusBadge(id){const st=(DATA.pubStatus||{})[id]||{};const names={xiaohongshu:'小红书',weixin:'视频号',youtube:'YT',douyin:'抖音'};const keys=Object.keys(st);
  if(!keys.length) return '<span class="mut">未发</span>';
  return keys.map(k=>{const ok=st[k].ok;return '<span class="tag" style="color:'+(ok?'#3ad07d':'#ff6b6b')+';border:1px solid '+(ok?'#2e6b48':'#6b2e2e')+'">'+(ok?'✓':'✗')+(names[k]||k)+'</span>';}).join(' ');}
function renderPending(){const el=document.getElementById('pending');
  if(!DATA.pending.length){el.innerHTML='<div class="empty">暂无待发切片。在「②切片渲染」渲染后会出现在这里。</div>';return;}
  let h='<table><tr><th>切片</th><th>标题</th><th>发布状态</th><th>逐个平台发布（点一下只发那个）</th></tr>';
  DATA.pending.forEach((c)=>{const st=(DATA.pubStatus||{})[c.id]||{};
    const btns=PLATS.map(([k,n])=>{const ok=st[k]&&st[k].ok,fail=st[k]&&!st[k].ok;const label=(ok?'重发 ':(fail?'重试 ':'发 '))+n;
      const style='margin:3px;padding:6px 12px;'+(ok?'background:#214a32;color:#9be7b6':(fail?'background:#4a2121;color:#ffb0b0':''));
      return '<button style="'+style+'" onclick="pub(\\''+c.id+'\\',\\''+k+'\\')">'+label+'</button>';}).join('');
    h+='<tr><td><b>'+c.id+'</b></td><td>'+c.title+'</td><td>'+statusBadge(c.id)+'</td><td>'+btns+'</td></tr>';});
  el.innerHTML=h+'</table>';}
function renderPub(){document.getElementById('published').innerHTML=DATA.published.length?
  '<table><tr><th>切片</th><th>标题</th><th>已发平台</th></tr>'+DATA.published.map(c=>'<tr><td>'+c.id+'</td><td>'+c.title+'</td><td><span class="tag">'+((c.published||'?').split(',').join('</span> <span class="tag">'))+'</span></td></tr>').join('')+'</table>':'<div class="empty">无</div>';}
function renderLog(){document.getElementById('log').textContent=DATA.logs[CUR]||'(暂无)';}
function tab(k){CUR=k;document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.k===k));renderLog();}
function togPub(){const e=document.getElementById('published');e.style.display=e.style.display==='none'?'block':'none';}
async function transcribe(){const n=document.getElementById('n').value;const r=await fetch('/api/transcribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({count:n})});const j=await r.json();toast(j.msg||j.error);CUR='transcribe';tab('transcribe');}
async function pub(id,plat){const r=await fetch('/api/publish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,platforms:plat})});const j=await r.json();toast(j.msg||j.error);CUR='publish';tab('publish');}
async function login(p){const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({platform:p})});const j=await r.json();toast(j.msg||j.error);CUR='login';tab('login');}
setInterval(()=>document.getElementById('clock').textContent=new Date().toLocaleTimeString(),1000);
load();setInterval(load,5000);
</script></body></html>`;
