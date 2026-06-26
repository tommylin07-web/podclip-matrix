import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

type Word = { t: number; d: number; w: string; brk?: boolean };

// 抖音/Opus 式逐字字幕：标点处断句，单行过长（>6 字）也强制断行（大字少词，对标爆款）
const MAX_CHARS_PER_LINE = 6;

function groupLines(words: Word[]): Word[][] {
  const lines: Word[][] = [];
  let cur: Word[] = [];
  for (const word of words) {
    cur.push(word);
    if (word.brk || cur.length >= MAX_CHARS_PER_LINE) {
      lines.push(cur);
      cur = [];
    }
  }
  if (cur.length) lines.push(cur);
  return lines;
}

export const Karaoke: React.FC<{ words: Word[]; brand: string }> = ({ words, brand }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const lines = groupLines(words);
  // 找到当前时间所在行
  let activeLine = 0;
  for (let i = 0; i < lines.length; i++) {
    const first = lines[i][0];
    if (t >= first.t) activeLine = i;
  }
  const line = lines[activeLine];
  if (!line) return null;

  const lineStart = line[0].t;
  const lineIn = interpolate(t, [lineStart, lineStart + 0.25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 420,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        flexWrap: 'nowrap',
        padding: '0 60px',
        gap: '0 8px',
        opacity: lineIn,
        transform: `translateY(${interpolate(lineIn, [0, 1], [24, 0])}px)`,
      }}
    >
      {line.map((word, i) => {
        const active = t >= word.t && t < word.t + word.d;
        const past = t >= word.t + word.d;
        const pop = active
          ? interpolate(t, [word.t, word.t + 0.12], [1, 1.16], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          : 1;
        return (
          <span
            key={i}
            style={{
              fontSize: 104,
              fontWeight: 900,
              fontFamily: 'PingFang SC, sans-serif',
              color: active ? brand : past ? '#fff' : 'rgba(255,255,255,0.6)',
              transform: `scale(${pop})`,
              display: 'inline-block',
              textShadow: active
                ? `0 0 30px ${brand}99, 0 5px 18px rgba(0,0,0,0.85)`
                : '0 5px 18px rgba(0,0,0,0.85)',
              WebkitTextStroke: '3px rgba(0,0,0,0.5)',
              transition: 'none',
            }}
          >
            {word.w}
          </span>
        );
      })}
    </div>
  );
};
