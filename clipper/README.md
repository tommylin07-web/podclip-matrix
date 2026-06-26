# clipper — Remotion 切片/封面渲染器

一套**开箱即用**的竖屏播客切片模板：逐字卡拉OK字幕、Ken Burns 封面、开头封面卡（给视频号等平台自动取作封面）、片尾品牌卡、可选中英双语字幕、可选打赏二维码。

## 换成你的节目：只改一个文件

所有品牌文案/颜色/署名都集中在 [`src/brand.ts`](src/brand.ts)：

```ts
export const BRAND = {
  color: '#5b8cff',          // 你的品牌强调色
  name: 'Your Podcast',      // 节目名
  tagline: '· City',         // 副标题/城市，不要就留空
  defaultHost: 'Host',       // 默认主播名
  outro: { question, searchCta, listenOn, website },  // 片尾卡四行
  bottomCta: '▶ 完整一期搜「Your Podcast」',
  sponsorImage: '',          // 可选：打赏二维码（放 public/，填文件名）
};
```

再把你的 `public/logo.png` 放进去就能跑（见 [`public/README.md`](public/README.md)）。

## 两个入口（`render_clips.sh` 会调用它们）

- `./make_clip.sh <ep> <name> <start秒> <end秒> "<标签>" "<标题>" "<钩子>" [嘉宾] [英文字幕json]`
  → 裁音频段 + 生成词级字幕 spec + Remotion 渲染竖屏 mp4（1080×1920）。
- `./make_cover.sh <ep> <封面图> "<标签>" "<钩子(\n换行 ||高亮||)>" <输出名.png> [嘉宾]`
  → 渲染 1080×1440 封面图。

本地预览/调样式：`npm run studio`（Remotion Studio，热更新）。

## 组件

| 文件 | 作用 |
| --- | --- |
| `src/brand.ts` | **品牌配置（你主要改这里）** |
| `src/PodcastClip.tsx` | 竖屏短视频合成（字幕+封面+片尾卡+可选打赏码） |
| `src/Cover.tsx` | 封面图合成（1080×1440） |
| `src/Karaoke.tsx` | 中文逐字卡拉OK字幕 |
| `src/SubsEnPop.tsx` | 海外版英文跳词字幕 |
| `build_spec.py` | whisper.cpp 词级时间戳 → Remotion props |

## 数据约定

- 转写稿：`../data/transcripts/ep<ep>.json`（whisper.cpp `--output-json-full`，含词级时间戳）。
- 音频：`../data/audio/ep<ep>.m4a`。
- 节目清单 `../data/episodes.json`：数组，元素含 `id`、`audio`(音频URL)、`image`(封面图URL)、`title`；`make_clip.sh` 缺封面时按 `image` 下载。

安装：`cd clipper && npm install`（首次 Remotion 会拉一个无头 Chromium）。
