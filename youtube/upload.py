#!/usr/bin/env python3
"""上传视频到 YouTube（官方 Data API）。token.json 由 auth.py 一次性授权后长期复用。
用法:
  venv/bin/python upload.py --file clip.mp4 --title "标题 #Shorts" --desc "简介" --tags "a,b" --privacy public --thumb cover.png
也支持 --meta meta.json（字段 file/title/desc/tags/privacy/thumb）。

失败时会打印一行"真因"（授权失效 / 配额超限 / 服务端错误 / 其他），
便于上层 publish_matrix.sh 判断是否属于"瞬时故障不计入重试上限"。
"""
import argparse, json, os, sys
from google.auth.transport.requests import Request
from google.auth.exceptions import RefreshError
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

HERE = os.path.dirname(os.path.abspath(__file__))
TOKEN = os.path.join(HERE, "token.json")
SCOPES = ["https://www.googleapis.com/auth/youtube.upload",
          "https://www.googleapis.com/auth/youtube.readonly"]


def _explain_http(e):
    """从 HttpError 里抽出 (status, reason, message)。"""
    status = getattr(getattr(e, "resp", None), "status", None)
    reason = ""
    msg = ""
    try:
        data = json.loads((e.content or b"").decode("utf-8", "replace"))
        err = data.get("error", {})
        msg = err.get("message", "") or ""
        errs = err.get("errors") or []
        if errs:
            reason = errs[0].get("reason", "") or ""
    except Exception:
        msg = str(e)
    return status, reason, msg


def _die_http(e):
    """把 HttpError 归类成一行人类可读且可被 publish_matrix 识别的真因后退出。"""
    status, reason, msg = _explain_http(e)
    r = (reason or "").lower()
    tail = f"[reason={reason or '-'}] {msg}".strip()
    if status == 401 or r in ("authenticationrequired", "invalidcredentials", "unauthorized"):
        raise SystemExit(f"✗ YouTube 上传失败：授权失效（401 unauthorized，token 失效），"
                         f"请按 youtube/README.md 重新授权。{tail}")
    if status == 403 and any(k in r for k in ("quota", "ratelimit", "uploadlimit", "dailylimit")):
        raise SystemExit(f"✗ YouTube 上传失败：配额/上限超限（quota exceeded，reason={reason}）。"
                         f"通常次日配额重置后自动恢复，或去 Google Cloud 控制台申请提额。{msg}")
    if status == 403:
        raise SystemExit(f"✗ YouTube 上传失败：被拒绝（403 forbidden，reason={reason}）。"
                         f"可能是频道无上传权限、未通过验证或视频违规。{msg}")
    if status is not None and 500 <= status < 600:
        raise SystemExit(f"✗ YouTube 上传失败：Google 服务端错误（{status} server error，通常瞬时可重试）。{msg}")
    raise SystemExit(f"✗ YouTube 上传失败：HTTP {status}，{tail}")


def get_service():
    if not os.path.exists(TOKEN):
        raise SystemExit("缺少 token.json，请先用 auth.py 完成一次性授权（见 youtube/README.md）。")
    creds = Credentials.from_authorized_user_file(TOKEN, SCOPES)
    if not creds.valid and creds.refresh_token:
        try:
            creds.refresh(Request())
        except RefreshError as e:
            raise SystemExit(f"✗ YouTube 授权失效：token 刷新失败（refresh_token 可能已被撤销或过期，unauthorized），"
                             f"请按 youtube/README.md 重新授权。{e}")
        with open(TOKEN, "w") as f:
            f.write(creds.to_json())
    return build("youtube", "v3", credentials=creds)


def upload(file, title, desc, tags, privacy="public", category="22", thumb=None):
    yt = get_service()
    body = {
        "snippet": {"title": title[:100], "description": desc, "tags": tags, "categoryId": category},
        "status": {"privacyStatus": privacy, "selfDeclaredMadeForKids": False},
    }
    media = MediaFileUpload(file, chunksize=4 * 1024 * 1024, resumable=True, mimetype="video/mp4")
    req = yt.videos().insert(part="snippet,status", body=body, media_body=media)
    resp = None
    try:
        while resp is None:
            status, resp = req.next_chunk()
            if status:
                print(f"  上传中 {int(status.progress() * 100)}%", file=sys.stderr)
    except HttpError as e:
        _die_http(e)
    vid = resp["id"]
    print(f"✓ 已发布: https://youtu.be/{vid}")
    if thumb:
        if not os.path.isabs(thumb):
            thumb = os.path.join(HERE, thumb)
        if os.path.exists(thumb):
            try:
                yt.thumbnails().set(videoId=vid, media_body=MediaFileUpload(thumb)).execute()
                print(f"  ✓ 已设封面: {os.path.basename(thumb)}")
            except Exception as e:
                print(f"  ⚠️ 封面设置失败（忽略）: {str(e)[:100]}", file=sys.stderr)
    return vid


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--meta"); ap.add_argument("--file"); ap.add_argument("--title")
    ap.add_argument("--desc", default=""); ap.add_argument("--tags", default="")
    ap.add_argument("--privacy", default="public"); ap.add_argument("--thumb")
    a = ap.parse_args()
    if a.meta:
        m = json.load(open(a.meta, encoding="utf-8"))
        file, title, desc = m["file"], m["title"], m.get("desc", "")
        tags = m.get("tags", []); privacy = m.get("privacy", "public"); thumb = m.get("thumb")
    else:
        file, title, desc = a.file, a.title, a.desc
        tags = [t.strip() for t in a.tags.split(",") if t.strip()]
        privacy = a.privacy; thumb = a.thumb
    if not os.path.isabs(file):
        file = os.path.join(HERE, file)
    upload(file, title, desc, tags, privacy, thumb=thumb)


if __name__ == "__main__":
    main()
