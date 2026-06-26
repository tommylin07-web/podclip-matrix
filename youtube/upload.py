#!/usr/bin/env python3
"""上传视频到 YouTube（官方 Data API）。token.json 由 auth.py 一次性授权后长期复用。
用法:
  venv/bin/python upload.py --file clip.mp4 --title "标题 #Shorts" --desc "简介" --tags "a,b" --privacy public --thumb cover.png
也支持 --meta meta.json（字段 file/title/desc/tags/privacy/thumb）。
"""
import argparse, json, os, sys
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

HERE = os.path.dirname(os.path.abspath(__file__))
TOKEN = os.path.join(HERE, "token.json")
SCOPES = ["https://www.googleapis.com/auth/youtube.upload",
          "https://www.googleapis.com/auth/youtube.readonly"]


def get_service():
    if not os.path.exists(TOKEN):
        raise SystemExit("缺少 token.json，请先用 auth.py 完成一次性授权（见 youtube/README.md）。")
    creds = Credentials.from_authorized_user_file(TOKEN, SCOPES)
    if not creds.valid and creds.refresh_token:
        creds.refresh(Request())
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
    while resp is None:
        status, resp = req.next_chunk()
        if status:
            print(f"  上传中 {int(status.progress() * 100)}%", file=sys.stderr)
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
