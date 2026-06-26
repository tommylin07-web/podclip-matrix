#!/bin/bash
# 转写脚本（模板，按你的数据源改）。控制台「开始转写」会调用：./transcribe.sh [最多期数]
# 思路：从 data/episodes.json 取音频 → 下载 m4a → 16k wav → whisper.cpp 转写 → 产物落 data/transcripts/ep<id>.{json,srt,txt}
# whisper.cpp: https://github.com/ggerganov/whisper.cpp （需先编译 whisper-cli 并下载模型）
set -uo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
AUDIO="$ROOT/data/audio"; TRANS="$ROOT/data/transcripts"
MODEL="${WHISPER_MODEL:-$HOME/whisper-models/ggml-medium-q5_0.bin}"
LIMIT="${1:-9999}"
mkdir -p "$AUDIO" "$TRANS"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

node -e '
const eps = require("'"$ROOT"'/data/episodes.json");
for (const e of [...eps].sort((a,b)=>b.id-a.id)) console.log(e.id + "\t" + e.audio);
' | head -n "$LIMIT" | while IFS=$'\t' read -r ID URL; do
  [ -z "$URL" ] && continue
  [ -s "$TRANS/ep$ID.json" ] && continue            # 已转写跳过
  M4A="$AUDIO/ep$ID.m4a"; WAV="$AUDIO/ep$ID.wav"
  [ -s "$M4A" ] || curl -sL --retry 3 -m 1800 -o "$M4A" "$URL" || { echo "下载失败 EP$ID"; continue; }
  ffmpeg -y -hide_banner -loglevel error -i "$M4A" -ar 16000 -ac 1 -c:a pcm_s16le "$WAV" || continue
  whisper-cli -m "$MODEL" -l zh -f "$WAV" --output-json-full --output-txt --output-srt -of "$TRANS/ep$ID" \
    && echo "✓ EP$ID 完成" || echo "✗ EP$ID 失败"
  rm -f "$WAV"
done
echo "── 转写批处理结束"
