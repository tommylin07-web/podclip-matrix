# public/ — 静态资源

Remotion 用 `staticFile()` 从这里取图。你需要放：

| 文件 | 必需 | 说明 |
| --- | --- | --- |
| `logo.png` | ✅ | 你的节目 logo（方形，建议 ≥512×512）。角标、片尾卡、封面条都用它。 |
| `sfx/<名>.mp3` | ⬜ | 可选开场音效。`make_clip.sh` 默认不加；要加传 `build_spec.py --sfx <名>`。 |
| `sponsor.png` | ⬜ | 可选打赏/赞赏二维码。在 `src/brand.ts` 把 `sponsorImage` 填成 `'sponsor.png'` 才会显示。 |

> `assets/`（裁好的音频段、下载的封面）由脚本自动生成，已在 `.gitignore` 里。
>
> ⚠️ **`sponsor.png` 是个人收款码，属敏感信息**——公开仓库别提交真图，已在 `.gitignore` 忽略。本地放一张即可。
