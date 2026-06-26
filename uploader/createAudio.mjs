// 视频号「音频号」上传器（整集播客音频 → 视频号音频）。本地 Playwright + .profile-weixin 持久化登录。
// 用法: node createAudio.mjs job_audio.json [--publish]
//   job_audio.json: { audio, title, desc, topics:[...], publish? }   audio=MP3/WAV 本地路径
//
// 致谢：跨 iframe 自动化视频号助手的思路参考自
//   https://github.com/icytear-svg/podcast-to-wechat-audio （MIT, Copyright (c) 2026 zhaole.xyz）
//   完整许可见仓库根目录 THIRD_PARTY_NOTICES.md。
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROFILE = path.join(HERE, '.profile-weixin');
const DEBUG = path.join(HERE, 'debug');
fs.mkdirSync(DEBUG, { recursive: true });

const jobPath = process.argv[2];
const doPublish = process.argv.includes('--publish');
if (!jobPath) { console.error('用法: node createAudio.mjs job_audio.json [--publish]'); process.exit(1); }
const job = JSON.parse(fs.readFileSync(jobPath, 'utf8'));
const audio = path.isAbsolute(job.audio) ? job.audio : path.resolve(HERE, job.audio);
if (!fs.existsSync(audio)) { console.error('音频不存在: ' + audio); process.exit(1); }

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const ctx = await chromium.launchPersistentContext(PROFILE, { channel: 'chrome', headless: false, viewport: { width: 1440, height: 1000 } });
const page = ctx.pages()[0] || (await ctx.newPage());
const shot = (n) => page.screenshot({ path: path.join(DEBUG, n), fullPage: false }).catch(() => {});

log('打开音频发表页…');
await page.goto('https://channels.weixin.qq.com/platform/post/createAudio', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await shot('A01-open.png');
if (page.url().includes('login')) { log('⚠️ 未登录，请先 node login.mjs 扫码。'); await ctx.close(); process.exit(2); }

const scopes = () => [page, ...page.frames().filter(f => f !== page.mainFrame())];
async function firstVisible(selector) {
  for (const sc of scopes()) {
    const loc = sc.locator(selector);
    const n = await loc.count().catch(() => 0);
    for (let i = 0; i < n; i++) { const el = loc.nth(i); if (await el.isVisible().catch(() => false)) return el; }
  }
  return null;
}

// 1) 上传音频
try {
  await page.locator('input[type="file"]').first().setInputFiles(audio, { timeout: 20000 });
  log('已选择音频，等待上传/解析…（整集较大，可能要等几十秒）');
} catch (e) { log('✗ 音频文件输入未找到：', e.message); }
await page.waitForTimeout(15000);

// 2) 标题
try {
  const ti = await firstVisible('input[placeholder*="标题"]') || await firstVisible('textarea[placeholder*="标题"]');
  if (ti) { await ti.fill((job.title || '').slice(0, 30)); log('已填标题'); } else log('· 标题输入未找到');
} catch (e) { log('标题异常：', e.message); }

// 3) 描述（音频号是裸 <textarea placeholder="请填写描述">）
try {
  const descFull = (job.desc || '') + (job.topics?.length ? ' ' + job.topics.map(t => (t.startsWith('#') ? t : '#' + t)).join(' ') : '');
  const ed = await firstVisible('textarea[placeholder*="描述"]') || await firstVisible('textarea.weui-desktop-form__textarea') || await firstVisible('[contenteditable]');
  if (ed) { await ed.click().catch(() => {}); await page.waitForTimeout(200); await ed.fill(descFull).catch(async () => { await page.keyboard.type(descFull, { delay: 10 }); }); log('已填描述+话题'); }
  else log('· 描述编辑器未找到');
} catch (e) { log('描述异常：', e.message); }

await shot('A03-filled.png');

// 4) 发表（默认不发，留确认）
if (doPublish || job.publish === true) {
  try {
    const pub = await firstVisible('button:has-text("发表")');
    if (pub) { await pub.click({ timeout: 5000 }); log('✓ 已点击发表'); }
    await page.waitForTimeout(2000);
    const cf = await firstVisible('button:has-text("直接发表")') || await firstVisible('button:has-text("确认")');
    if (cf && await cf.isVisible().catch(() => false)) { await cf.click().catch(() => {}); log('✓ 已确认发表'); }
    await page.waitForTimeout(5000); await shot('A04-published.png');
  } catch (e) { log('发表异常：', e.message); }
} else {
  log('（未发布：表单已填，请核对后手动点发表，或加 --publish）');
}
try { await page.waitForTimeout(doPublish ? 4000 : 90000); } catch {}
try { await ctx.close(); } catch {}
log('完成。调试产物在 debug/');
