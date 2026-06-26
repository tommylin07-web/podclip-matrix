// 视频号助手登录（扫码）。本地 Playwright + .profile-weixin 持久化登录，之后上传脚本复用。
// 运行: node login.mjs
//
// 致谢：本目录脚本"跨 iframe 自动化视频号助手"的思路参考自
//   https://github.com/icytear-svg/podcast-to-wechat-audio （MIT, Copyright (c) 2026 zhaole.xyz）
//   完整许可见仓库根目录 THIRD_PARTY_NOTICES.md。
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROFILE = path.join(HERE, '.profile-weixin');

const ctx = await chromium.launchPersistentContext(PROFILE, {
  channel: 'chrome', headless: false, viewport: { width: 1440, height: 900 },
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto('https://channels.weixin.qq.com/platform', { waitUntil: 'domcontentloaded' });

console.log('请在打开的浏览器里用微信扫码登录视频号助手…');
const deadline = Date.now() + 5 * 60 * 1000;
let ok = false;
while (Date.now() < deadline) {
  await page.waitForTimeout(3000);
  const url = page.url();
  if (url.includes('login')) continue;
  const loggedIn =
    (await page.getByText('发表视频').count().catch(() => 0)) +
    (await page.getByText('内容管理').count().catch(() => 0)) +
    (await page.getByText('数据中心').count().catch(() => 0));
  if (url.includes('/platform') && loggedIn > 0) { ok = true; break; }
}
console.log(ok ? '✓ 已检测到登录态，已持久化到 .profile-weixin/。' : '⚠️ 未检测到登录态；若你已登录，关掉即可，登录态仍会保存。');
await page.waitForTimeout(30000);
await ctx.close();
