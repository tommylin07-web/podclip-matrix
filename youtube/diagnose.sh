#!/bin/bash
# 一键诊断 YouTube 上传通道：自动定位项目 / venv / 测试视频，用「私密 private」方式试传一次，
# 失败时打印一行真因（授权失效 / 配额超限 / 被拒绝 / 服务端错误）。不会公开发布。
# 用法（在项目任意位置执行）：
#   bash youtube/diagnose.sh              # 自动挑 clips/ 下最新的一个 mp4
#   bash youtube/diagnose.sh 某个.mp4     # 指定测试视频
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
PY="$HERE/venv/bin/python"
UP="$HERE/upload.py"

echo "▶ 项目目录: $ROOT"

# 1) 依赖检查（缺什么直接说人话）
[ -f "$HERE/token.json" ] || { echo "✗ 缺少 youtube/token.json —— 还没做过一次性授权。见 youtube/README.md「一次性授权」。"; exit 1; }
[ -x "$PY" ] || { echo "✗ 缺少 youtube/venv 里的 Python —— 还没建虚拟环境。见 youtube/README.md 第 3 步。"; exit 1; }
[ -f "$UP" ] || { echo "✗ 找不到 upload.py（$UP）。"; exit 1; }

# 2) 找测试视频：命令行传入优先，否则挑 clips/ 下最新的 mp4
VIDEO="${1:-}"
if [ -z "$VIDEO" ]; then
  VIDEO=$(ls -1t "$ROOT"/clips/*.mp4 2>/dev/null | head -1)
fi
[ -n "$VIDEO" ] && [ -f "$VIDEO" ] || { echo "✗ 没找到测试视频。请指定：bash youtube/diagnose.sh <某个.mp4>"; exit 1; }

echo "▶ 测试视频: $VIDEO"
echo "▶ 开始试传（私密 private，不会公开；成功后请去 YouTube 后台自行删除这条测试视频）…"
echo "------------------------------------------------------------"
"$PY" "$UP" --file "$VIDEO" --title "PodClip 诊断测试 请忽略" --desc "自动诊断，可删除" --privacy private
rc=$?
echo "------------------------------------------------------------"
if [ "$rc" -eq 0 ]; then
  echo "✅ YouTube 上传通道正常（凭证、配额都 OK）。上面链接那条私密测试视频记得去后台删掉。"
else
  echo "❌ 上传失败。真因见上面那行以 ✗ 开头的说明——把它复制给我，我帮你定下一步。"
fi
exit "$rc"
