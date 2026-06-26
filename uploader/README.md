# uploader — 视频号 / 音频号 本地上传（Playwright，可选）

主链路的视频号分发走 `social-auto-upload`（`sau tencent`）。这里是**另一套本地 Playwright 实现**，两种场景下更合适：

- **视频号视频**（`shipinhao.mjs`）：需要"声明原创 + 挂微信小店商品 + 自定义封面"，且想用你自己的系统 Chrome 登录态。
- **音频号**（`createAudio.mjs`）：把**整集播客音频**传成视频号「音频」——这是 `sau` 暂不覆盖的能力。

> 致谢：跨 iframe 自动化视频号助手的思路参考自
> [icytear-svg/podcast-to-wechat-audio](https://github.com/icytear-svg/podcast-to-wechat-audio)（MIT, © 2026 zhaole.xyz）。
> 见仓库根目录 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)。

## 用法

```bash
npm i playwright-core            # 依赖
node login.mjs                   # 扫码登录视频号助手（一次，存到 .profile-weixin/）
node shipinhao.mjs job.json            # 填好表单不发，留你核对
node shipinhao.mjs job.json --publish  # 自动发
node createAudio.mjs job_audio.json --publish
```

- 视频号助手页面常改版 → 选择器可能失效。脚本会在 `debug/` 存截图和 `selectors.json`，照真实页面调即可。
- `job.json` / `job_audio.json` 字段见同目录 `*.example.json`。
- ⚠️ `.profile-weixin/`（登录态）已被 `.gitignore`，**绝不要提交**。
