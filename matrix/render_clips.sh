#!/bin/bash
# 渲染某一期的切片：读 matrix/cuts/ep<ep>.jsonl，逐条 make_clip + make_cover，
# 渲染好的登记进 clips.jsonl（待发）。已渲染的跳过。
# 音频来源：data/audio/ep<ep>.m4a；不在则尝试从 data/episodes.json 取 audio 字段下载。
# 用法: ./render_clips.sh <epid>
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EP="${1:?用法: render_clips.sh <epid>}"
CUTS="$ROOT/matrix/cuts/ep${EP}.jsonl"
CLIPPER="$ROOT/clipper"
CLIPS="$ROOT/matrix/clips.jsonl"
LOG="$ROOT/logs/render.log"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
mkdir -p "$ROOT/logs" "$ROOT/data/audio"
ts(){ date '+%F %T'; }
[ -f "$CUTS" ] || { echo "$(ts) 没有切片定义: $CUTS" | tee -a "$LOG"; exit 1; }
echo "$(ts) ===== 渲染 EP$EP =====" >> "$LOG"

M4A="$ROOT/data/audio/ep${EP}.m4a"
if [ ! -s "$M4A" ]; then
  URL=$(node -e "try{const e=require('$ROOT/data/episodes.json').find(x=>x.id==$EP);process.stdout.write(e&&e.audio?e.audio:'')}catch(_){process.stdout.write('')}")
  [ -z "$URL" ] && { echo "$(ts) ✗ 找不到 EP$EP 音频：请把 m4a 放到 data/audio/ep${EP}.m4a，或在 data/episodes.json 配 audio 地址" | tee -a "$LOG"; exit 1; }
  echo "$(ts) ↓ 下载音频 EP$EP" >> "$LOG"
  curl -sL --retry 3 -m 1800 -o "$M4A" "$URL" >> "$LOG" 2>&1 || { echo "$(ts) ✗ 音频下载失败" | tee -a "$LOG"; exit 1; }
fi

n_ok=0
while IFS= read -r line; do
  [ -z "$line" ] && continue
  case "$line" in \#*) continue;; esac
  eval "$(echo "$line" | python3 -c "
import json,sys,shlex
d=json.load(sys.stdin)
for k in ['id','name','start','end','label','title','hook','cover_hook','pub_title','desc','tags']:
    print(f'{k.upper()}={shlex.quote(str(d.get(k,\"\")))}')
")"
  OUT="$ROOT/clips/ep${EP}/${NAME}_remotion.mp4"
  if [ -s "$OUT" ]; then
    echo "$(ts) · $ID 已渲染过，跳过出片" >> "$LOG"
  else
    if ! ( cd "$CLIPPER" && bash make_clip.sh "$EP" "$NAME" "$START" "$END" "$LABEL" "$TITLE" "$HOOK" ) >> "$LOG" 2>&1; then
      echo "$(ts) ✗ 出片失败 $ID" >> "$LOG"; continue
    fi
    ( cd "$CLIPPER" && bash make_cover.sh "$EP" "assets/ep${EP}_cover.jpg" "$LABEL" "$COVER_HOOK" "${ID}.png" ) >> "$LOG" 2>&1 || echo "$(ts) · 封面生成失败 $ID（不挡发布）" >> "$LOG"
  fi
  if ! grep -Fq "\"$ID\"" "$CLIPS" 2>/dev/null; then
    ID="$ID" NAME="$NAME" EP="$EP" PUB_TITLE="$PUB_TITLE" DESC="$DESC" TAGS="$TAGS" CLIPS="$CLIPS" python3 -c "
import json,os
o={'id':os.environ['ID'],'video':f\"clips/ep{os.environ['EP']}/{os.environ['NAME']}_remotion.mp4\",'cover':f\"clips/covers/{os.environ['ID']}.png\",'title':os.environ['PUB_TITLE'],'desc':os.environ['DESC'],'tags':os.environ['TAGS']}
open(os.environ['CLIPS'],'a').write(json.dumps(o,ensure_ascii=False)+'\n')
"
  fi
  echo "$(ts) ✓ $ID 完成" >> "$LOG"; n_ok=$((n_ok+1))
done < "$CUTS"
echo "$(ts) ===== EP$EP 渲染结束，成功 $n_ok 条 =====" >> "$LOG"
