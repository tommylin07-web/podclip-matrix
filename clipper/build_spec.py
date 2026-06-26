#!/usr/bin/env python3
"""从 whisper.cpp full-JSON 抽取切片范围内的词级字幕，生成 Remotion props JSON。

用法:
    python3 build_spec.py \
        --json ../data/transcripts/ep01.json \
        --audio assets/ep01_c1.mp3 \
        --cover assets/ep01_cover.jpg \
        --start 630 --end 730 \
        --ep "EP01 · 城市" \
        --title "一句抓人的\n标题" \
        --hook '"放一句最有钩子的话"' \
        --out specs/ep01_c1.json

时间戳按「相对切片开始」输出。中文按字切分（whisper token 常是字/子词），每个字带 t/d。
转写稿需为 whisper.cpp `--output-json-full` 产出（含 transcription[].tokens[].offsets）。
"""
import argparse
import json


def load_char_timeline(json_path):
    with open(json_path, encoding="utf-8", errors="surrogateescape") as f:
        data = json.load(f)
    byte_list, byte_times = [], []
    for seg in data["transcription"]:
        for tok in seg.get("tokens", []):
            text = tok["text"]
            if text.startswith("[_") and text.endswith("]"):
                continue
            t0 = tok["offsets"]["from"] / 1000.0
            t1 = tok["offsets"]["to"] / 1000.0
            for b in text.encode("utf-8", errors="surrogateescape"):
                byte_list.append(b)
                byte_times.append((t0, t1))
    text = bytes(byte_list).decode("utf-8", errors="replace")
    char_times, i = [], 0
    for ch in text:
        n = len(ch.encode("utf-8", errors="replace"))
        span = byte_times[i:i + n] or [(0, 0)]
        char_times.append((min(s for s, _ in span), max(e for _, e in span)))
        i += n
    return text, char_times


def build_words(text, char_times, start, end):
    """逐字输出 [start,end) 内的字符（中文卡拉OK正宗做法）：每字一个 token，
    带自身时间；标点不单独成字，附到上一字尾部用于断句。"""
    PUNCT = "，。！？、；：…— “”\"'（）()"
    out = []
    for ch, (c0, c1) in zip(text, char_times):
        if c1 < start or c0 > end:
            continue
        if ch in PUNCT or ch.strip() == "":
            if ch in "，。！？、；：…\n" and out:
                out[-1]["brk"] = True
            continue
        rt = max(0.0, c0 - start)
        dur = max(0.12, min(c1 - c0, 0.8))
        out.append({"t": round(rt, 2), "d": round(dur, 2), "w": ch})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", required=True)
    ap.add_argument("--audio", required=True)
    ap.add_argument("--cover", required=True)
    ap.add_argument("--start", type=float, required=True)
    ap.add_argument("--end", type=float, required=True)
    ap.add_argument("--ep", required=True)
    ap.add_argument("--title", required=True)
    ap.add_argument("--hook", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--host", default="Host")  # 主播；建议与 src/brand.ts 的 defaultHost 一致
    ap.add_argument("--guest", default="")      # 本期嘉宾（空则只显示主播）
    ap.add_argument("--en", default="")         # 海外版英文字幕 json 路径([{t,text}])，给则带双语
    ap.add_argument("--cover-card", type=float, default=1.2)  # 开头封面卡秒数(0=不加)
    ap.add_argument("--cover-hook", default="")  # 封面卡大钩子(\\n换行 ||高亮||)，缺省用标题
    ap.add_argument("--sfx", default="")        # 开场音效名（对应 public/sfx/<名>.mp3）；空=不加
    a = ap.parse_args()

    text, ct = load_char_timeline(a.json)
    words = build_words(text, ct, a.start, a.end)
    spec = {
        "epLabel": a.ep,
        "title": a.title.replace("\\n", "\n"),
        "hook": a.hook.replace("\\n", "\n"),
        "coverSrc": a.cover,
        "audioSrc": a.audio,
        "audioStartSec": a.start,
        "durationSec": round(a.end - a.start, 2),
        "words": words,
        "sfx": ([{"t": 0.05, "name": a.sfx}] if a.sfx else []),
        "host": a.host,
        "guest": a.guest,
        "coverCardSec": a.cover_card,
    }
    if a.cover_hook:
        spec["coverHook"] = a.cover_hook.replace("\\n", "\n")
    if a.en:
        with open(a.en, encoding="utf-8") as f:
            spec["subsEn"] = json.load(f)
    import os
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(spec, f, ensure_ascii=False, indent=1)
    print(f"已生成 {a.out}：{len(words)} 词，时长 {spec['durationSec']}s")


if __name__ == "__main__":
    main()
