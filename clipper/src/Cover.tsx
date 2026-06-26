import { AbsoluteFill, Img, staticFile, getInputProps } from 'remotion';
import { z } from 'zod';
import { BRAND } from './brand';

export const coverSchema = z.object({
  epLabel: z.string(),
  coverHook: z.string(), // 巨大钩子文字，\n 换行；用 || 包裹的词高亮
  coverSrc: z.string(),
  epTitle: z.string().optional(), // 本期节目总标题（小字，建立完整节目认知）
  host: z.string().optional(), // 主播（默认 brand.defaultHost）
  guest: z.string().optional(), // 本期嘉宾
});
export type CoverProps = z.infer<typeof coverSchema>;

const ACCENT = BRAND.color;

// 把 ||词|| 渲染成高亮
function renderHook(text: string) {
  return text.split('\n').map((line, li) => (
    <div key={li}>
      {line.split('||').map((seg, i) =>
        i % 2 === 1 ? (
          <span key={i} style={{ color: ACCENT }}>{seg}</span>
        ) : (
          <span key={i}>{seg}</span>
        )
      )}
    </div>
  ));
}

export const Cover: React.FC<CoverProps> = (props) => {
  const input = getInputProps() as Partial<CoverProps>;
  const { epLabel, coverHook, coverSrc, epTitle, host, guest } = { ...props, ...input };
  const hostName = host || BRAND.defaultHost;
  const credit = guest ? `主播 ${hostName} · 嘉宾 ${guest}` : `主播 ${hostName}`;

  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.bg }}>
      {/* 背景：封面图铺满 + 强暗化 */}
      {coverSrc ? (
        <>
          <Img
            src={coverSrc.startsWith('http') ? coverSrc : staticFile(coverSrc)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(18px) brightness(0.4)' }}
          />
          <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(13,13,13,0.55) 0%, rgba(13,13,13,0.2) 45%, rgba(13,13,13,0.85) 100%)' }} />
        </>
      ) : null}

      {/* 顶部：品牌条 */}
      <div style={{ position: 'absolute', top: 60, left: 60, right: 60, display: 'flex', alignItems: 'center', gap: 20 }}>
        <Img src={staticFile('logo.png')} style={{ width: 96, height: 96, borderRadius: 20 }} />
        <div style={{ fontFamily: 'PingFang SC, sans-serif', color: '#fff', fontWeight: 800, fontSize: 40 }}>
          {BRAND.name} {BRAND.tagline ? <span style={{ color: ACCENT }}>{BRAND.tagline}</span> : null}
        </div>
        <div style={{ marginLeft: 'auto', color: ACCENT, fontWeight: 700, fontSize: 34, fontFamily: 'PingFang SC, sans-serif' }}>{epLabel}</div>
      </div>

      {/* 参与者署名（品牌条下方居中胶囊） */}
      <div
        style={{
          position: 'absolute',
          top: 180,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.5)',
          border: `2px solid ${ACCENT}`,
          color: '#fff',
          fontFamily: 'PingFang SC, sans-serif',
          fontWeight: 700,
          fontSize: 36,
          padding: '12px 36px',
          borderRadius: 50,
          whiteSpace: 'nowrap',
        }}
      >
        🎙 {credit}
      </div>

      {/* 中部：巨大钩子文字 */}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 70px' }}>
        <div
          style={{
            fontFamily: 'PingFang SC, sans-serif',
            fontWeight: 900,
            fontSize: 118,
            lineHeight: 1.18,
            color: '#fff',
            textAlign: 'center',
            textShadow: '0 8px 36px rgba(0,0,0,0.85)',
            WebkitTextStroke: '2px rgba(0,0,0,0.35)',
          }}
        >
          {renderHook(coverHook)}
        </div>
      </AbsoluteFill>

      {/* 本期节目总标题（小字，建立完整节目认知） */}
      {epTitle ? (
        <div
          style={{
            position: 'absolute',
            bottom: 180,
            left: 80,
            right: 80,
            textAlign: 'center',
            fontFamily: 'PingFang SC, sans-serif',
            fontSize: 32,
            fontWeight: 600,
            lineHeight: 1.35,
            color: 'rgba(255,255,255,0.8)',
            textShadow: '0 3px 14px rgba(0,0,0,0.9)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          <span style={{ color: ACCENT }}>本期 · </span>{epTitle}
        </div>
      ) : null}

      {/* 底部：引导条 */}
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          background: ACCENT,
          color: '#000',
          fontFamily: 'PingFang SC, sans-serif',
          fontWeight: 800,
          fontSize: 38,
          padding: '18px 50px',
          borderRadius: 50,
          whiteSpace: 'nowrap',
        }}
      >
        {BRAND.bottomCta}
      </div>
    </AbsoluteFill>
  );
};
