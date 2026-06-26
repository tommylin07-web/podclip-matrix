#!/bin/bash
# 单条切片 → 指定平台分发（封面 3:4 自动带；每平台成败写入 publish_status.json）。
# 用法: ./publish_matrix.sh <clip_id> [platforms]   platforms 逗号分隔
#   演练: DRY=1 ...   不带封面: NOCOVER=1 ...
# 配置(环境变量): SAU_ACCOUNT(默认 default) SAU_DIR(默认 ~/social-auto-upload)
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JOBS="$ROOT/matrix/clips.jsonl"
STATUS="$ROOT/matrix/publish_status.json"
ACCOUNT="${SAU_ACCOUNT:-default}"
SAU_DIR="${SAU_DIR:-$HOME/social-auto-upload}"
ID="${1:-}"
PLATFORMS="${2:-xiaohongshu,weixin}"
[ -z "$ID" ] && { echo "用法: ./publish_matrix.sh <clip_id> [xiaohongshu,weixin,youtube,douyin]"; exit 1; }

SAU="sau"
[ -x "$SAU_DIR/.venv/bin/sau" ] && SAU="$SAU_DIR/.venv/bin/sau"

# 按 id 在 clips.jsonl 里找该切片（逐行读取，不用 eval）
{ read -r OKFLAG; read -r VIDEO; read -r COVER; read -r TITLE; read -r DESC; read -r TAGS; } < <(ID="$ID" JOBS="$JOBS" python3 - <<'PY'
import json, os
idv = os.environ["ID"]; f = os.environ["JOBS"]; found = None
for line in open(f, encoding="utf-8"):
    line = line.strip()
    if not line or line.startswith("#"):
        continue
    try:
        d = json.loads(line)
    except Exception:
        continue
    if d.get("id") == idv:
        found = d; break
if found:
    print("OK")
    for k in ["video", "cover", "title", "desc", "tags"]:
        print(str(found.get(k, "")).replace("\n", " "))
PY
)
[ "${OKFLAG:-}" = "OK" ] || { echo "未找到切片 $ID（见 matrix/clips.jsonl）"; exit 1; }
VIDEO="$ROOT/$VIDEO"; COVER="$ROOT/$COVER"
[ ! -f "$VIDEO" ] && { echo "✗ 视频不存在: $VIDEO（先渲染出片）"; exit 1; }
[ ! -f "$COVER" ] && echo "⚠️ 封面不存在: $COVER（这条会没封面）"

record(){ # platform ok(1/0)
  ID="$ID" PLAT="$1" OK="$2" STATUS="$STATUS" python3 -c '
import json,os,time
f=os.environ["STATUS"]; d={}
try: d=json.load(open(f))
except Exception: d={}
d.setdefault(os.environ["ID"],{})[os.environ["PLAT"]]={"ok":os.environ["OK"]=="1","at":time.strftime("%m-%d %H:%M")}
json.dump(d,open(f,"w"),ensure_ascii=False,indent=1)
'
}
pubrun(){ # platform cmd...
  local plat="$1"; shift
  echo "+ $*"
  if [ "${DRY:-0}" = "1" ]; then echo "  (DRY) 跳过"; return 0; fi
  if "$@"; then echo "  ✓ $plat 成功"; record "$plat" 1; else echo "  ✗ $plat 失败"; record "$plat" 0; fi
}

THUMB=(); YTTHUMB=()
if [ "${NOCOVER:-0}" != "1" ] && [ -f "$COVER" ]; then THUMB=(--thumbnail "$COVER"); YTTHUMB=(--thumb "$COVER"); fi

IFS=',' read -ra PS <<< "$PLATFORMS"
for p in "${PS[@]}"; do
  case "$p" in
    douyin|dy)
      pubrun douyin "$SAU" douyin upload-video --account "$ACCOUNT" --headed \
        --file "$VIDEO" --title "$TITLE" --desc "$DESC" --tags "$TAGS" ${THUMB[@]+"${THUMB[@]}"} ;;
    xiaohongshu|xhs)
      pubrun xiaohongshu "$SAU" xiaohongshu upload-video --account "$ACCOUNT" --headed \
        --file "$VIDEO" --title "$TITLE" --desc "$DESC" --tags "$TAGS" ${THUMB[@]+"${THUMB[@]}"} ;;
    weixin|tencent)
      pubrun weixin "$SAU" tencent upload-video --account "$ACCOUNT" --headed \
        --file "$VIDEO" --title "$TITLE" --desc "$DESC" --tags "$TAGS" ${THUMB[@]+"${THUMB[@]}"} ;;
    youtube|yt)
      # YouTube 走官方 API 上传器（自备 token.json，见 youtube/）
      pubrun youtube "$ROOT/youtube/venv/bin/python" "$ROOT/youtube/upload.py" \
        --file "$VIDEO" --title "$TITLE" --desc "$DESC" --tags "$TAGS" --privacy public ${YTTHUMB[@]+"${YTTHUMB[@]}"} ;;
    *) echo "未知平台: $p" ;;
  esac
done
echo "✓ 完成: $ID → $PLATFORMS"
