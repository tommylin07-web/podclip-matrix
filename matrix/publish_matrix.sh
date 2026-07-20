#!/bin/bash
# 单条切片 → 指定平台分发（封面 3:4 自动带；每平台成败写入 publish_status.json）。
# 用法: ./publish_matrix.sh <clip_id> [platforms]   platforms 逗号分隔
#   演练: DRY=1 ...   不带封面: NOCOVER=1 ...
#   强制重发已成功平台: FORCE=1 ...
# 配置(环境变量): SAU_ACCOUNT(默认 default) SAU_DIR(默认 ~/social-auto-upload)
#   MAX_ATTEMPTS(默认 3): 同一切片同一平台连续失败达到该次数后标记 giving_up，选片侧视同已处理。
#
# 幂等保证: 发布前会查 publish_status.json，某平台已 ok:true 就跳过（除非 FORCE=1），
#   避免"一个平台失败导致另一个已成功平台被无限重发"。
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

record(){ # platform ok(1/0) -> stdout: ok | fail | giving_up
  ID="$ID" PLAT="$1" OK="$2" STATUS="$STATUS" MAXATT="${MAX_ATTEMPTS:-3}" python3 -c '
import json,os,time
f=os.environ["STATUS"]; d={}
try: d=json.load(open(f))
except Exception: d={}
cid=os.environ["ID"]; plat=os.environ["PLAT"]; ok=os.environ["OK"]=="1"
prev=(d.get(cid,{}) or {}).get(plat,{}) or {}
att=int(prev.get("attempts",0))+1
rec={"ok":ok,"at":time.strftime("%Y-%m-%d %H:%M:%S"),"attempts":att}
try: maxatt=int(os.environ["MAXATT"])
except Exception: maxatt=3
if ok:
    att=0; rec["attempts"]=0          # 成功后清零，便于日后需要时重新计数
elif att>=maxatt:
    rec["giving_up"]=True
d.setdefault(cid,{})[plat]=rec
json.dump(d,open(f,"w"),ensure_ascii=False,indent=1)
print("ok" if ok else ("giving_up" if rec.get("giving_up") else "fail"))
'
}
already_ok(){ # platform -> exit 0 当该切片该平台已 ok:true
  ID="$ID" PLAT="$1" STATUS="$STATUS" python3 -c '
import json,os,sys
try: d=json.load(open(os.environ["STATUS"]))
except Exception: sys.exit(1)
rec=(d.get(os.environ["ID"],{}) or {}).get(os.environ["PLAT"],{}) or {}
sys.exit(0 if rec.get("ok") else 1)
' 2>/dev/null
}
pubrun(){ # platform cmd...
  local plat="$1"; shift
  if [ "${FORCE:-0}" != "1" ] && already_ok "$plat"; then
    echo "  ⏭  $plat 已发布成功，跳过（FORCE=1 可强制重发）"; return 0
  fi
  echo "+ $*"
  if [ "${DRY:-0}" = "1" ]; then echo "  (DRY) 跳过"; return 0; fi
  local r
  if "$@"; then r=$(record "$plat" 1); echo "  ✓ $plat 成功"; else
    r=$(record "$plat" 0)
    if [ "$r" = "giving_up" ]; then
      echo "  ✗ $plat 失败：已连续失败达上限（MAX_ATTEMPTS=${MAX_ATTEMPTS:-3}），标记放弃，选片将跳过它"
    else
      echo "  ✗ $plat 失败"
    fi
  fi
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
