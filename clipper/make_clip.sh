#!/bin/bash
# 一步出片：裁音频段 → 抽词级时间戳 spec → Remotion 渲染竖屏 mp4。
# 用法: ./make_clip.sh <epid> <name> <start秒> <end秒> "<EP标签>" "<标题(\n换行)>" "<hook(\n换行)>" [嘉宾] [英文字幕json]
#   第8参数 嘉宾(可选，空则只显示主播)；第9参数 英文字幕json路径(可选，给则出中英双语海外版)。
set -euo pipefail
cd "$(dirname "$0")"
EP="$1"; NAME="$2"; START="$3"; END="$4"; LABEL="$5"; TITLE="$6"; HOOK="$7"
GUEST="${8:-}"; EN="${9:-}"
DUR=$(echo "$END - $START" | bc)
SRCAUDIO="../data/audio/ep${EP}.m4a"
COVER="public/assets/ep${EP}_cover.jpg"
SEG="public/assets/ep${EP}_${NAME}.mp3"
SPEC="specs/ep${EP}_${NAME}.json"
OUT="../clips/ep${EP}/${NAME}_remotion.mp4"

mkdir -p public/assets specs "../clips/ep${EP}"
# 封面（已存在则跳过）。从 ../data/episodes.json 取本期 image 字段下载。
if [ ! -s "$COVER" ]; then
  IMG=$(node -e "console.log(require('../data/episodes.json').find(e=>e.id==$EP).image)")
  curl -sL -o "$COVER" "$IMG"
fi
# 裁音频段
ffmpeg -nostdin -y -hide_banner -loglevel error -ss "$START" -t "$DUR" -i "$SRCAUDIO" -c:a libmp3lame -q:a 4 "$SEG"
# 生成 spec（音频已裁切 → audioStartSec=0）
EN_ARG=(); [ -n "$EN" ] && EN_ARG=(--en "$EN")
python3 build_spec.py --json "../data/transcripts/ep${EP}.json" \
  --audio "assets/ep${EP}_${NAME}.mp3" --cover "assets/ep${EP}_cover.jpg" \
  --start "$START" --end "$END" --ep "$LABEL" --title "$TITLE" --hook "$HOOK" \
  --guest "$GUEST" ${EN_ARG[@]+"${EN_ARG[@]}"} --out "$SPEC"
python3 -c "import json; d=json.load(open('$SPEC')); d['audioStartSec']=0; json.dump(d,open('$SPEC','w'),ensure_ascii=False,indent=1)"
# 渲染
npx remotion render src/index.ts PodcastClip "$OUT" --props="$SPEC" --log=error </dev/null
echo "✓ $OUT (${DUR}s)"
