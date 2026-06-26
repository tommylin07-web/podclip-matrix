#!/bin/bash
# 生成封面 (1080x1440 PNG)。
# 用法: ./make_cover.sh <epid> <封面图(public/assets/..)> "<EP标签>" "<钩子文字 \n换行 ||词||高亮>" <输出名> [嘉宾]
set -euo pipefail
cd "$(dirname "$0")"
EP="$1"; COVER="$2"; LABEL="$3"; HOOK="$4"; OUT="$5"; GUEST="${6:-}"
# 自动从 episodes.json 取本期节目总标题（拿不到就留空）
EPTITLE=$(node -e "const e=require('../data/episodes.json').find(x=>x.id==$EP); process.stdout.write(e?e.title:'')" 2>/dev/null || echo "")
PROPS=$(python3 -c "import json,sys; print(json.dumps({'epLabel':sys.argv[1],'coverHook':sys.argv[2].replace('\\\\n','\n'),'coverSrc':sys.argv[3],'epTitle':sys.argv[4],'guest':sys.argv[5]}))" "$LABEL" "$HOOK" "$COVER" "$EPTITLE" "$GUEST")
echo "$PROPS" > /tmp/cover_props.json
mkdir -p ../clips/covers
npx remotion still src/index.ts Cover "../clips/covers/$OUT" --props=/tmp/cover_props.json --log=error
echo "✓ ../clips/covers/$OUT"
