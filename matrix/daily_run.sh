#!/bin/bash
# 每日全自动闭环（launchd/cron 每天定点调用）：
#   1) 自动渲染 cuts/ep*.jsonl 里还没出片的切片（已渲染的跳过）；
#   2) 选片：优先 schedule.txt 当天排期；没有则从 clips.jsonl 挑没发过的前 DAILY_COUNT 条；
#   3) 自动发布到默认平台；
#   4) 登录过期 → Mac 桌面通知 + 微信(Server酱，把 SENDKEY 存到 matrix/serverchan.key)。
# 配置: DAILY_COUNT(默认8) PLATFORMS(默认 xiaohongshu,weixin,youtube)
# 安全阀: 存在 matrix/PAUSE 文件则暂停（首行日期到期自动恢复，无日期则需手工删除）。
# 选片口径: 一条切片所有目标平台都 ok 或 giving_up 才算发完；失败平台会重试(不重发已成功平台)，
#           连续失败达 MAX_ATTEMPTS(默认3) 次后放弃，避免单条永久堵塞队列。
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MATRIX="$ROOT/matrix"
LOG="$ROOT/logs/matrix-daily.log"
mkdir -p "$ROOT/logs"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
DEFAULT_PLATFORMS="${PLATFORMS:-xiaohongshu,weixin,youtube}"
DAILY_COUNT="${DAILY_COUNT:-8}"
DAY="${DATE:-$(date '+%Y-%m-%d')}"
ts(){ date '+%F %T'; }
notify(){
  osascript -e "display notification \"$2\" with title \"$1\" sound name \"Glass\"" >/dev/null 2>&1 || true
  local kf="$MATRIX/serverchan.key"
  [ -s "$kf" ] && curl -s "https://sctapi.ftqq.com/$(cat "$kf").send" --data-urlencode "title=$1" --data-urlencode "desp=$2" >/dev/null 2>&1 || true
}

# 紧急止血开关：存在 matrix/PAUSE 则暂停发布。
#   文件首个非注释行若是 YYYY-MM-DD 日期，则该日期(含)当天起自动恢复；
#   没有可识别日期时视为无限期暂停，需手工删除文件才恢复（更安全）。
PAUSE_FILE="$MATRIX/PAUSE"
if [ -f "$PAUSE_FILE" ]; then
  RESUME=$(grep -vE '^[[:space:]]*#' "$PAUSE_FILE" | grep -m1 -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' || true)
  if [ -z "$RESUME" ] || [ "$DAY" \< "$RESUME" ]; then
    echo "$(ts) ⏸ 发布已暂停（matrix/PAUSE，恢复日期：${RESUME:-未设置/需手工删除}）。" >> "$LOG"
    exit 0
  fi
  echo "$(ts) ▶ PAUSE 恢复日期 $RESUME 已到，继续发布（如未修复问题请删除或后移该日期）。" >> "$LOG"
fi

echo "$(ts) ========== 每日自动作业开始 ==========" >> "$LOG"

for f in "$MATRIX"/cuts/ep*.jsonl; do
  [ -e "$f" ] || continue
  ep=$(basename "$f" .jsonl | sed 's/ep//')
  bash "$MATRIX/render_clips.sh" "$ep" >> "$LOG" 2>&1 || true
done

IDS=$(grep "^$DAY[[:space:]]" "$MATRIX/schedule.txt" 2>/dev/null | awk '{print $2}')
if [ -z "$IDS" ]; then
  IDS=$(CLIPS="$MATRIX/clips.jsonl" STATUS="$MATRIX/publish_status.json" N="$DAILY_COUNT" PLATFORMS="$DEFAULT_PLATFORMS" python3 - <<'PY'
import json, os
clips = []
try:
    for line in open(os.environ["CLIPS"], encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#"): continue
        try: clips.append(json.loads(line)["id"])
        except Exception: pass
except Exception: pass
st = {}
try: st = json.load(open(os.environ["STATUS"]))
except Exception: pass
plats = [p for p in os.environ.get("PLATFORMS", "").split(",") if p.strip()]
def done(cid):
    # 一条切片"发完了"= 每个目标平台要么已成功，要么已放弃(giving_up)。
    # 这样失败的平台会被重试(publish 侧会跳过已成功平台，不会重发)，
    # 但重试到上限后整条视同处理完，队列不会被单条永久堵死。
    pd = st.get(cid, {}) or {}
    if not plats:
        return any(v.get("ok") for v in pd.values())
    return all((pd.get(p, {}) or {}).get("ok") or (pd.get(p, {}) or {}).get("giving_up") for p in plats)
out = [c for c in clips if not done(c)]
print("\n".join(out[: int(os.environ["N"])]))
PY
)
fi

if [ -z "$IDS" ]; then
  echo "$(ts) 今天没有可发的新片。" >> "$LOG"
  notify "PodClip：片库见底" "没有新切片可发了，记得补片。"
  exit 0
fi

TMP=$(mktemp)
for ID in $IDS; do
  echo "$(ts) ▶ 发布 $ID → $DEFAULT_PLATFORMS" | tee -a "$LOG" >> "$TMP"
  ( cd "$MATRIX" && ./publish_matrix.sh "$ID" "$DEFAULT_PLATFORMS" ) 2>&1 | tee -a "$TMP" >> "$LOG"
done

if grep -qiE "cookie.*(missing|expired|失效)|请先.*login|未登录" "$TMP"; then
  notify "PodClip：有平台需要重新登录" "打开控制台，点对应平台的『登录』后会自动恢复。"
  echo "$(ts) ⚠️ 检测到登录过期，已通知。" >> "$LOG"
fi
if grep -q "标记放弃" "$TMP"; then
  notify "PodClip：有切片放弃发布" "有平台连续失败已达上限被放弃，请查看 logs/matrix-daily.log 与 publish_status.json。"
  echo "$(ts) ⚠️ 有切片达重试上限被放弃，已通知。" >> "$LOG"
fi
rm -f "$TMP"
echo "$(ts) ========== 每日自动作业结束 ==========" >> "$LOG"
