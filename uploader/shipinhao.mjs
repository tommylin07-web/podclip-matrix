// 视频号自动上传器（本地 Playwright + 持久化登录）。社区分发引擎之外的一种本地实现，
// 适合需要"声明原创 + 挂微信小店商品 + 自定义封面"且想用系统 Chrome 的场景。
// 用法: node shipinhao.mjs job.json [--publish]
//   不带 --publish：填好表单但不点发表，留你确认。
// job.json 字段: { video, shortTitle(≤16), desc, topics:[...], collection?, product?, cover?, publish? }
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
if (!jobPath) { console.error('用法: node shipinhao.mjs job.json [--publish]'); process.exit(1); }
const job = JSON.parse(fs.readFileSync(jobPath, 'utf8'));
const video = path.isAbsolute(job.video) ? job.video : path.resolve(HERE, job.video);
if (!fs.existsSync(video)) { console.error('视频不存在: ' + video); process.exit(1); }

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const shot = (name) => page.screenshot({ path: path.join(DEBUG, name), fullPage: false }).catch(() => {});

const ctx = await chromium.launchPersistentContext(PROFILE, {
  channel: 'chrome', headless: false, viewport: { width: 1440, height: 1000 },
});
const page = ctx.pages()[0] || (await ctx.newPage());

log('打开发表页…');
await page.goto('https://channels.weixin.qq.com/platform/post/create', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await shot('01-open.png');

if (page.url().includes('login') || (await page.locator('text=扫码登录, text=登录').count().catch(() => 0)) > 0) {
  log('⚠️ 未登录或登录失效，请先运行 node login.mjs 扫码登录。');
  await shot('00-need-login.png');
  await ctx.close(); process.exit(2);
}

// 1) 上传视频
try {
  await page.locator('input[type="file"]').first().setInputFiles(video, { timeout: 15000 });
  log('已选择视频，等待上传/解析…');
} catch (e) { log('✗ 视频文件输入未找到：', e.message); }
await page.waitForTimeout(8000);
await shot('02-after-upload.png');

for (const t of ['我知道了']) {
  try { const b = page.locator(`button:has-text("${t}")`).first(); if (await b.count() && await b.isVisible()) await b.click({ timeout: 1500 }); } catch {}
}

// 跨 frame 搜索：视频号助手内容常在 iframe 内（思路参考 podcast-to-wechat-audio）
const scopes = () => [page, ...page.frames().filter(f => f !== page.mainFrame())];
async function firstVisible(selector) {
  for (const sc of scopes()) {
    const loc = sc.locator(selector);
    const n = await loc.count().catch(() => 0);
    for (let i = 0; i < n; i++) { const el = loc.nth(i); if (await el.isVisible().catch(() => false)) return el; }
  }
  return null;
}

// 等视频处理完成：合集/商品/封面等控件要等视频解析完才出现
log('等待视频处理完成（控件就绪）…');
for (let i = 0; i < 25; i++) {
  if (await firstVisible('text=封面预览') || await firstVisible('text=选择链接') || await firstVisible('text=选择合集')) break;
  await page.waitForTimeout(3000);
}
await page.waitForTimeout(1500);

// 2) 描述（裸 contenteditable，跨 frame）
try {
  const descFull = (job.desc || '') + (job.topics?.length ? ' ' + job.topics.map(t => (t.startsWith('#') ? t : '#' + t)).join(' ') : '');
  let ed = await firstVisible('[contenteditable]') || await firstVisible('[role="textbox"]') || await firstVisible('div.input-editor') || await firstVisible('textarea[placeholder*="描述"]');
  if (!ed) { const ph = await firstVisible('text=添加描述'); if (ph) { await ph.click(); await page.waitForTimeout(300); ed = await firstVisible('[contenteditable]'); } }
  if (ed) { await ed.click(); await page.waitForTimeout(300); await page.keyboard.type(descFull, { delay: 10 }); log('已填描述+话题'); }
  else log('· 描述编辑器未找到');
} catch (e) { log('描述填充异常：', e.message); }

// 3) 短标题（≤16，逗号等替换为空格）
try {
  const clean = (job.shortTitle || '').replace(/[，,、。!！;；…—\-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 16);
  const st = await firstVisible('input[placeholder*="短标题"]') || await firstVisible('input[placeholder*="标题"]');
  if (st && clean) { await st.fill(clean); log('已填短标题：' + clean); }
} catch (e) { log('短标题填充异常：', e.message); }

// 4) 合集（找不到指定合集就跳过，绝不乱归类）
try {
  if (job.collection) {
    const sel = await firstVisible('text=选择合集');
    if (sel) {
      await sel.click(); await page.waitForTimeout(900);
      const opt = await firstVisible(`text=${job.collection}`);
      if (opt) { await opt.click(); log('已选合集：' + job.collection); }
      else { await page.keyboard.press('Escape').catch(() => {}); log('· 合集「' + job.collection + '」不存在，已跳过（先在视频号后台建好）'); }
    }
  }
} catch (e) { log('合集异常：', e.message); }

// 5) 商品（微信小店；job.product 为商品名/ID 关键词）。含「选择商品出现时机」二级弹窗确认。
try {
  if (job.product) {
    const linkSel = await firstVisible('text=选择链接');
    if (linkSel) {
      await linkSel.click(); await page.waitForTimeout(700);
      const goods = await firstVisible('text=商品');
      if (goods) { await goods.click(); await page.waitForTimeout(900); }
      const openPicker = await firstVisible('text=选择需要添加的商品') || await firstVisible('text=选择商品');
      if (openPicker) { await openPicker.click(); await page.waitForTimeout(1200); }
      const sb = await firstVisible('input[placeholder*="商品ID"]') || await firstVisible('input[placeholder*="商品名称"]') || await firstVisible('input[placeholder*="商品"]');
      if (sb) {
        await sb.fill(job.product); await page.keyboard.press('Enter').catch(() => {}); await page.waitForTimeout(2000);
        await shot('03b-product-search.png');
        const pickBox = await firstVisible('.weui-desktop-card__bd input[type="checkbox"]') || await firstVisible('.weui-desktop-card__bd input[type="radio"]');
        if (pickBox) { await pickBox.click({ force: true }).catch(() => {}); }
        else { const pick = await firstVisible(`text=${job.product}`); if (pick) await pick.click().catch(() => {}); }
        await page.waitForTimeout(600);
        const ok = await firstVisible('button:has-text("确定")') || await firstVisible('button:has-text("确认")') || await firstVisible('button:has-text("添加")');
        if (ok) { await ok.click().catch(() => {}); log('已选中商品：' + job.product); }
        await page.waitForTimeout(1200);
        const timing = await firstVisible('text=选择商品出现时机');
        if (timing) {
          const tok = await firstVisible('.weui-desktop-dialog button:has-text("确认")') || await firstVisible('button:has-text("确认")');
          if (tok) { await tok.click().catch(() => {}); log('✓ 已确认商品出现时机'); }
          await page.waitForTimeout(900);
        }
      } else log('· 未找到商品搜索框');
    }
  }
} catch (e) { log('商品添加异常：', e.message); }
await page.waitForTimeout(800);

// 6) 声明原创：点说明文字入口 → 勾"我已阅读并同意" → 点未禁用的"声明原创"
try {
  const entry = await firstVisible('text=声明后') || await firstVisible('text=展示原创标记') || await firstVisible('.weui-desktop-form__check-label') || await firstVisible('text=声明原创');
  if (entry) {
    await entry.click().catch(() => {}); await page.waitForTimeout(1200); await shot('03a-original-dialog.png');
    const agree = await firstVisible('text=我已阅读并同意');
    if (agree) { await agree.click().catch(() => {}); }
    else { const cb = await firstVisible('.weui-desktop-dialog input[type="checkbox"]'); if (cb) await cb.click({ force: true }).catch(() => {}); }
    await page.waitForTimeout(700);
    let decl = null;
    for (const sc of scopes()) {
      const loc = sc.locator('button.weui-desktop-btn_primary:not(.weui-desktop-btn_disabled)', { hasText: '声明原创' });
      const n = await loc.count().catch(() => 0);
      for (let i = 0; i < n; i++) { const el = loc.nth(i); if (await el.isVisible().catch(() => false) && await el.isEnabled().catch(() => false)) { decl = el; break; } }
      if (decl) break;
    }
    if (decl) { await decl.click().catch(() => {}); log('✓ 已声明原创'); }
    else { const cancel = await firstVisible('.weui-desktop-dialog button:has-text("取消")') || await firstVisible('button:has-text("取消")'); if (cancel) await cancel.click().catch(() => {}); log('· 原创按钮未启用，已跳过'); }
  }
} catch (e) { log('原创处理异常：', e.message); }
await page.waitForTimeout(1500); await shot('03-filled.png');

// 6.5) 封面：点"编辑"开编辑器 → 走"上传封面"文件选择器喂图 → 点"确认"提交
try {
  if (job.cover) {
    const coverImg = path.isAbsolute(job.cover) ? job.cover : path.resolve(HERE, job.cover);
    if (!fs.existsSync(coverImg)) { log('· 封面图不存在，跳过：' + coverImg); }
    else {
      let editorOpen = false;
      for (let tryi = 0; tryi < 3 && !editorOpen; tryi++) {
        const opener = await firstVisible('text=更换封面') || await firstVisible('text=编辑封面') || await firstVisible('text=编辑');
        if (opener) { await opener.click().catch(() => {}); await page.waitForTimeout(1500); }
        editorOpen = !!(await firstVisible('text=从视频中选择封面') || await firstVisible('text=上传封面'));
      }
      await shot('03c-cover-dialog.png');
      if (!editorOpen) { log('· 没能打开封面编辑器（看 03c）'); }
      else {
        let uploaded = false;
        const up = await firstVisible('text=上传封面') || await firstVisible('text=本地上传');
        if (up) {
          const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 8000 }).catch(() => null), up.click().catch(() => {})]);
          if (chooser) { await chooser.setFiles(coverImg).catch(() => {}); uploaded = true; log('已上传封面，等待裁剪…'); await page.waitForTimeout(3000); }
        }
        if (!uploaded) {
          for (const sc of scopes()) {
            const fis = sc.locator('input[type="file"]'); const n = await fis.count().catch(() => 0);
            for (let i = 0; i < n; i++) { const a = (await fis.nth(i).getAttribute('accept').catch(() => '')) || ''; if (a.includes('image')) { await fis.nth(i).setInputFiles(coverImg).catch(() => {}); uploaded = true; break; } }
            if (uploaded) break;
          }
          if (uploaded) await page.waitForTimeout(3000);
        }
        await shot('03c2-cover-cropping.png');
        let ok = 0;
        for (let i = 0; i < 12 && !ok; i++) {
          const b = await firstVisible('button.weui-desktop-btn_primary:has-text("确认")') || await firstVisible('button.weui-desktop-btn_primary:has-text("确定")');
          if (b && await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); ok = 1; } else await page.waitForTimeout(1000);
        }
        await page.waitForTimeout(1200);
        log((ok && !(await firstVisible('text=编辑封面'))) ? '✓ 封面已确认' : '· 封面确认情况见 03c2/03d 截图');
      }
    }
  }
} catch (e) { log('封面处理异常：', e.message); }
await page.waitForTimeout(800); await shot('03d-after-cover.png');

// 调试：导出页面可填字段（便于按真实页面校准选择器）
try {
  const dumpFn = () => {
    const pick = (els) => [...els].slice(0, 50).map(el => ({ tag: el.tagName.toLowerCase(), type: el.getAttribute('type') || '', ce: el.getAttribute('contenteditable'), role: el.getAttribute('role') || '', placeholder: el.getAttribute('placeholder') || el.getAttribute('data-placeholder') || '', text: (el.innerText || el.textContent || '').trim().slice(0, 30), cls: (el.className || '').toString().slice(0, 70) }));
    return { inputs: pick(document.querySelectorAll('input,textarea,[contenteditable],[role="textbox"]')), buttons: pick(document.querySelectorAll('button,[role="button"]')) };
  };
  const all = { mainFrame: await page.evaluate(dumpFn), frames: [] };
  for (const f of page.frames()) { if (f === page.mainFrame()) continue; try { all.frames.push({ url: f.url().slice(0, 80), ...(await f.evaluate(dumpFn)) }); } catch {} }
  fs.writeFileSync(path.join(DEBUG, 'selectors.json'), JSON.stringify(all, null, 2));
} catch {}

// 7) 发表
const publishNow = doPublish || job.publish === true;
if (publishNow) {
  try {
    const pub = await firstVisible('button:has-text("发表")');
    if (pub) { await pub.click({ timeout: 5000 }); log('✓ 已点击发表'); }
    await page.waitForTimeout(2000);
    const confirm = await firstVisible('button:has-text("直接发表")') || await firstVisible('button:has-text("确认")');
    if (confirm && await confirm.isVisible().catch(() => false)) { await confirm.click().catch(() => {}); log('✓ 已确认发表'); }
    await page.waitForTimeout(5000); await shot('04-published.png');
  } catch (e) { log('发表点击异常：', e.message); }
} else {
  log('（未发布，表单已填好，请核对后手动点发表；或加 --publish）');
}
try { await page.waitForTimeout(publishNow ? 4000 : 90000); } catch {}
try { await ctx.close(); } catch {}
log('完成。调试产物在 debug/');
