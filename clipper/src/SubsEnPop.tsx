import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

type Sub = { t: number; text: string };

// 国际 Shorts 风格英文字幕：一次只跳 1-2 个单词，带弹入动画。
// 输入是句级 subsEn[{t,text}]；组件把每句拆成 1-2 词的块，
// 在该句时间区间内（到下一句开始为止）均匀分布逐块弹出。
const WORDS_PER_CHUNK = 2;
const LAST_SUB_HOLD = 3.0; // 最后一句没有"下一句"时的默认持续秒

function chunkWords(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += WORDS_PER_CHUNK) {
    chunks.push(words.slice(i, i + WORDS_PER_CHUNK).join(' '));
  }
  return chunks;
}

export const SubsEnPop: React.FC<{ subs: Sub[]; brand: string }> = ({ subs, brand }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  if (!subs || !subs.length) return null;

  // 当前所在句
  let idx = -1;
  for (let i = 0; i < subs.length; i++) {
    if (t >= subs[i].t) idx = i;
    else break;
  }
  if (idx < 0) return null;

  const cur = subs[idx];
  const nextT = idx + 1 < subs.length ? subs[idx + 1].t : cur.t + LAST_SUB_HOLD;
  const span = Math.max(0.6, nextT - cur.t);
  const chunks = chunkWords(cur.text);
  if (!chunks.length) return null;

  const chunkDur = span / chunks.length;
  const elapsed = t - cur.t;
  let ci = Math.floor(elapsed / chunkDur);
  if (ci >= chunks.length) ci = chunks.length - 1;
  const chunkStart = cur.t + ci * chunkDur;

  // 弹入：scale + 上移
  const pop = spring({
    frame: Math.round((t - chunkStart) * fps),
    fps,
    config: { damping: 14, mass: 0.4, stiffness: 180 },
    durationInFrames: Math.round(0.35 * fps),
  });
  const scale = interpolate(pop, [0, 1], [0.7, 1]);
  const rise = interpolate(pop, [0, 1], [18, 0]);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 290,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        padding: '0 70px',
      }}
    >
      <span
        style={{
          fontFamily: 'Inter, Helvetica, Arial, sans-serif',
          fontWeight: 900,
          fontSize: 72,
          letterSpacing: 0.5,
          color: '#fff',
          textTransform: 'uppercase',
          textAlign: 'center',
          lineHeight: 1.1,
          transform: `translateY(${rise}px) scale(${scale})`,
          textShadow: `0 0 28px ${brand}66, 0 6px 20px rgba(0,0,0,0.9)`,
          WebkitTextStroke: '3px rgba(0,0,0,0.55)',
          display: 'inline-block',
        }}
      >
        {chunks[ci]}
      </span>
    </div>
  );
};
