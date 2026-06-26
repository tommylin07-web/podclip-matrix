# youtube — 官方 API 上传器

YouTube 不走浏览器自动化（Google 反自动化严），改用官方 Data API。

## 一次性授权

1. 在 [Google Cloud Console](https://console.cloud.google.com/) 建项目，启用 **YouTube Data API v3**，建 OAuth 客户端（桌面应用），下载 `client_secret.json`。
2. 写一个 `auth.py`（用 `google-auth-oauthlib` 走一次 OAuth），生成 `token.json`（含 refresh_token，长期复用）。
3. 建虚拟环境装依赖：
   ```bash
   cd youtube && python3 -m venv venv && ./venv/bin/pip install google-api-python-client google-auth-oauthlib
   ```

## upload.py

`publish_matrix.sh` 调用：
```bash
youtube/venv/bin/python youtube/upload.py --file <视频> --title <标题> --desc <简介> --tags a,b --privacy public --thumb <封面png>
```
- 竖屏 + <3min + 标题/简介带 `#Shorts` → 自动归类 Shorts。
- `--thumb` 设自定义封面（避免 Shorts 用空白帧）。

> ⚠️ `token.json`、`client_secret.json` 已在 `.gitignore`，**绝不要提交**。
