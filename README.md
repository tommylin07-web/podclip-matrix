# PodClip Matrix · 播客切片矩阵分发

把一期长播客，自动切成竖屏短视频，带封面、声明原创，一键/定时分发到 **小红书 / 视频号 / 抖音 / YouTube**——全部在一个**本地网页控制台**里点按钮完成，不用碰命令行。

> 适合：自托管、用自己电脑的系统浏览器（绕开云端沙箱对大文件/登录态的限制）发内容的播客主与创作者。
>
> 🤝 与具体 AI 助手无关：本项目就是一套 shell / Node / Python 脚本 + 本地网页控制台，任何能执行命令的环境或 agent（Claude、Codex、Cursor，或纯手动）都能驱动。

---

## 它能做什么

- 🎬 **整期 → 切片**：从词级转写稿挑片段，用 [Remotion](https://www.remotion.dev/) 渲染竖屏短视频（冷开场大字幕 + 封面卡首帧 + 片尾品牌卡）+ 生成 3:4 封面图。
- 🚀 **多平台分发**：封装 [social-auto-upload](https://github.com/dreammis/social-auto-upload)，一条命令发小红书/视频号/抖音；YouTube 走官方 API。封面、原创声明自动带上。
- 🖥️ **本地控制台**：零依赖的 Node 网页，转写 / 渲染 / 逐平台发布 / 登录 / 看日志 / 看每条的 ✓✗ 发布状态，全在浏览器点。
- ⏰ **每日全自动**：launchd/cron 每天自动渲染新片 + 挑没发过的 + 发布；登录过期推**微信(Server酱)**或 Mac 桌面通知提醒你。
- 🧠 **选题方法论**：见 [`docs/clip-selection.md`](docs/clip-selection.md)，一套可复用的"哪段值得切"的判断标准。

---

## 架构

```
转写稿(.json/.srt) ──► cuts/ep<N>.jsonl ──► render_clips.sh ──► Remotion 渲染
   (whisper.cpp)        (人/LLM 挑片段+文案)        │                mp4 + 3:4 封面
                                                    ▼
                                            clips.jsonl(待发库)
                                                    ▼
   控制台 / daily_run.sh ──► publish_matrix.sh ──► social-auto-upload(小红书/视频号/抖音)
                                                 └► youtube/upload.py(官方 API)
                                                    ▼
                                          publish_status.json(每条每平台 ✓✗)
```

## 目录

| 路径 | 作用 |
| --- | --- |
| `control-panel/server.js` | 本地网页控制台（零依赖 Node） |
| `matrix/publish_matrix.sh` | 单条切片 → 指定平台分发（封面/原创自动带） |
| `matrix/daily_run.sh` | 每日全自动：渲染+选片+发布+登录提醒 |
| `matrix/render_clips.sh` | 按 `cuts/ep<N>.jsonl` 渲染整期切片 → 登记进 `clips.jsonl` |
| `clipper/` | Remotion 切片/封面模板 + `make_clip.sh` / `make_cover.sh` |
| `youtube/upload.py` | YouTube 官方 API 上传器（token.json，自己授权） |
| `uploader/` | 视频号/音频号本地 Playwright 上传器（可选；原创+小店商品+自定义封面） |
| `docs/clip-selection.md` | 切片选题判断标准 |
| `matrix/*.example.*` | 示例：切片定义、待发库、排期 |

---

## 前置依赖

- macOS（脚本用了 `osascript`/`launchd`；Linux 也可，需改通知方式与定时器）
- Node 18+、Python 3.10+、`ffmpeg`、[whisper.cpp](https://github.com/ggerganov/whisper.cpp)（转写，可选自带）
- [social-auto-upload](https://github.com/dreammis/social-auto-upload)（国内三平台分发引擎）
- 各平台账号；YouTube 需自建 OAuth（见 `youtube/`）

## 快速开始

```bash
# 1) 装分发引擎（一次性）
git clone https://github.com/dreammis/social-auto-upload ~/social-auto-upload
cd ~/social-auto-upload && uv venv && source .venv/bin/activate && uv pip install -e . && patchright install chromium
cp conf.example.py conf.py            # 按需设 LOCAL_CHROME_PATH

# 2) 各平台登录（扫码，账号名自定）
sau douyin login --account default
sau xiaohongshu login --account default
sau tencent login --account default --headed

# 3) 起控制台
node control-panel/server.js          # 浏览器开 http://localhost:8787
```

配置（环境变量，均有默认值）：
- `SAU_ACCOUNT`（默认 `default`）：social-auto-upload 的账号名
- `SAU_DIR`（默认 `~/social-auto-upload`）
- `DAILY_COUNT`（默认 8）：每天自动发几条
- `PLATFORMS`（默认 `xiaohongshu,weixin,youtube`）

## 日常用法

1. 准备 `matrix/cuts/ep<N>.jsonl`（每行一个片段：起止秒 + 标题 + 封面钩子 + 文案，见 `cuts/example.example.jsonl`）；
2. 控制台「切片渲染」点渲染 → 出 mp4 + 封面，自动进「待发」；
3. 「待发」里逐平台点发布，或开启每日自动（`daily_run.sh` + launchd）。

---

## ⚠️ 安全（务必先读）

- **绝不要提交**：`token.json`、`cookies/`、`.profile-*/`、`serverchan.key`、`conf.py`、任何账号 cookie/密钥。`.gitignore` 已覆盖，但**若你 fork 自带内容的仓库，先确认 git 历史里没有这些**（删文件不够，要清历史，如 `git filter-repo`）。
- 登录态/Token 泄露 = 别人可直接接管你的平台账号、乱发内容。

## ⚖️ 合规与免责

- 本项目封装 [social-auto-upload](https://github.com/dreammis/social-auto-upload)（致谢原作者）。各平台对自动化发布有自己的服务条款，**自动化发布属灰色地带，请自担风险**，低频、内容真实原创、避免搬运/刷屏。
- 本工具仅供个人内容分发提效，请勿用于批量搬运或垃圾信息。

## 致谢

- [social-auto-upload](https://github.com/dreammis/social-auto-upload) · [Remotion](https://www.remotion.dev/) · [whisper.cpp](https://github.com/ggerganov/whisper.cpp) · [Server酱](https://sct.ftqq.com/)
- [podcast-to-wechat-audio](https://github.com/icytear-svg/podcast-to-wechat-audio)（MIT, © 2026 zhaole.xyz）：`uploader/` 里"跨 iframe 自动化视频号助手"的思路参考自此项目。完整许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 参与共建

欢迎更多人一起优化这套工具 🙌 —— 平台选择器经常因改版失效、各家分发逻辑也在变，一个人盯不过来。欢迎提 Issue / PR：新增平台、修选择器、改进选题方法论、补文档都很好。

如果它对你有用，点个 Star 让我知道就够了；有想法或踩了坑，直接开 Issue，不用客气。

⚠️ 请勿在 PR 里附带任何账号 cookie、token 或个人二维码。

## 关于作者

我是 Tommy，以**一人公司**（OPC / 超级个体）的方式运营一整套内容生态：

- **播客本体**：《黑熊电台》，2018 年开播的厦门话题播客，194 期、双周更 —— 聊这座城的人、事、教育与文化。
- **视频矩阵**：每期节目切成竖屏短视频，视频号 + YouTube 每日自动发布约 8 条。
- **内容资产**：194 期全文转写、词级时间戳，随每集页面上站可读可搜。

这套 PodClip Matrix 不是演示项目，就是上面「视频矩阵」那一环的真实生产管线 —— 一个人要维持这个更新量，只能靠它跑。开源出来，是希望同样在单打独斗的创作者少走点弯路。

更多：[tommyeverything.com](https://tommyeverything.com)

## License

MIT，见 [LICENSE](LICENSE)。
