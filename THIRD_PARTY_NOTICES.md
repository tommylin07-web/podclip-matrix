# 第三方代码与致谢

本项目包含或借鉴了以下第三方开源项目，特此声明并致谢。

---

## podcast-to-wechat-audio

`uploader/` 目录下的视频号 / 音频号本地上传脚本（`shipinhao.mjs`、`createAudio.mjs`、`login.mjs`），其"跨 iframe 自动化视频号助手"的思路与实现参考自该项目。

- 仓库：https://github.com/icytear-svg/podcast-to-wechat-audio
- 许可证：MIT

```
MIT License

Copyright (c) 2026 zhaole.xyz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 其它依赖（运行时依赖，非内置代码）

- [social-auto-upload](https://github.com/dreammis/social-auto-upload) — 抖音/小红书/视频号/B站分发引擎
- [Remotion](https://www.remotion.dev/) — 视频渲染
- [whisper.cpp](https://github.com/ggerganov/whisper.cpp) — 语音转写
- [Server酱](https://sct.ftqq.com/) — 微信推送
