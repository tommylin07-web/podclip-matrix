import {
  AbsoluteFill,
  Audio,
  Img,
  staticFile,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
} from 'remotion';
import { z } from 'zod';
import { Karaoke } from './Karaoke';
import { SubsEnPop } from './SubsEnPop';
import { BRAND } from './brand';

export const wordSchema = z.object({
  t: z.number(), // 相对切片开始的秒
  d: z.number(), // 持续秒
  w: z.string(),
  brk: z.boolean().optional(), // 此字后断句（标点处）
});

export const sfxSchema = z.object({
  t: z.number(),
  name: z.string(), // public/sfx/ 下的文件名（不含扩展）
});

export const clipSchema = z.object({
  epLabel: z.string(),
  title: z.string(),
  hook: z.string(),
  coverSrc: z.string(),
  audioSrc: z.string(),
  audioStartSec: z.number(),
  durationSec: z.number(),
  words: z.array(wordSchema),
  sfx: z.array(sfxSchema),
  subsEn: z.array(z.object({ t: z.number(), text: z.string() })).optional(), // 中英双语海外版：英文句级字幕
  host: z.string().optional(), // 主播（默认 brand.defaultHost）
  guest: z.string().optional(), // 本期嘉宾
  coverCardSec: z.number().optional(), // 开头封面卡时长(秒)，给视频第一帧一个封面；0/省略=不加
  coverHook: z.string().optional(), // 封面卡大钩子文字(\n换行 ||高亮||)，缺省用 title
});

export type ClipProps = z.infer<typeof clipSchema>;

const ACCENT = BRAND.color;
const BG = BRAND.bg;
const OUTRO_SEC = 1.5; // 片尾品牌卡时长（缩短，保完播率）

// 把 ||词|| 渲染成高亮（封面卡大钩子用）
function renderHook(text: string) {
  return text.split('\n').map((line, li) => (
    <div key={li}>
      {line.split('||').map((seg, i) =>
        i % 2 === 1 ? <span key={i} style={{ color: ACCENT }}>{seg}</span> : <span key={i}>{seg}</span>
      )}
    </div>
  ));
}

export const PodcastClip: React.FC<ClipProps> = ({
  epLabel,
  title,
  hook,
  coverSrc,
  audioSrc,
  audioStartSec,
  durationSec,
  words,
  sfx,
  subsEn,
  host,
  guest,
  coverCardSec,
  coverHook,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const hostName = host || BRAND.defaultHost;
  const credit = guest ? `🎙 ${hostName} × ${guest}` : `🎙 ${hostName}`;
  const cardSec = coverCardSec || 0;
  const inCard = t < cardSec;
  const cardFade = interpolate(t, [cardSec - 0.3, cardSec], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Ken Burns：封面缓慢放大
  const coverScale = interpolate(frame, [0, durationSec * fps], [1.04, 1.16]);

  // 冷开场：开头直接进画面+字幕，仅 0.4s 淡入
  const intro = interpolate(t, [0, 0.4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // 片尾品牌卡：最后 OUTRO_SEC 秒淡入
  const outroStart = durationSec - OUTRO_SEC;
  const outroProgress = interpolate(t, [outroStart, outroStart + 0.5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const inOutro = t >= outroStart;
  const logoPop = spring({ frame: frame - Math.round(outroStart * fps), fps, config: { damping: 12, mass: 0.5 } });

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* 音频（裁切到切片范围） */}
      {audioSrc ? (
        <Audio
          src={audioSrc.startsWith('http') ? audioSrc : staticFile(audioSrc)}
          startFrom={Math.round(audioStartSec * fps)}
          endAt={Math.round((audioStartSec + durationSec) * fps)}
        />
      ) : null}

      {/* 音效 */}
      {sfx.map((s, i) => (
        <Sequence key={i} from={Math.round(s.t * fps)} durationInFrames={fps * 2}>
          <Audio src={staticFile(`sfx/${s.name}.mp3`)} volume={0.6} />
        </Sequence>
      ))}

      {/* 背景：模糊封面铺满 + 暗化 */}
      {coverSrc ? (
        <AbsoluteFill>
          <Img
            src={coverSrc.startsWith('http') ? coverSrc : staticFile(coverSrc)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'blur(40px) brightness(0.35)',
              transform: 'scale(1.2)',
            }}
          />
          <AbsoluteFill style={{ backgroundColor: 'rgba(13,13,13,0.55)' }} />
        </AbsoluteFill>
      ) : null}

      {/* 顶部期数标识 */}
      <div
        style={{
          position: 'absolute',
          top: 70,
          left: 60,
          fontSize: 40,
          fontWeight: 700,
          color: ACCENT,
          fontFamily: 'PingFang SC, sans-serif',
          letterSpacing: 1,
        }}
      >
        {epLabel}
      </div>

      {/* logo 角标 */}
      <Img
        src={staticFile('logo.png')}
        style={{ position: 'absolute', top: 56, right: 56, width: 110, height: 110, borderRadius: 22 }}
      />

      {/* 封面（冷开场即出现，居中带 Ken Burns） */}
      <div
        style={{
          position: 'absolute',
          top: 480,
          left: '50%',
          transform: `translateX(-50%) scale(${coverScale})`,
          width: 760,
          height: 760,
          opacity: intro,
        }}
      >
        {coverSrc ? (
          <Img
            src={coverSrc.startsWith('http') ? coverSrc : staticFile(coverSrc)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 28 }}
          />
        ) : null}
      </div>

      {/* 标题常驻小条（顶部，不抢字幕） */}
      <div
        style={{
          position: 'absolute',
          top: 180,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 940,
          textAlign: 'center',
          fontSize: 50,
          fontWeight: 800,
          color: '#fff',
          lineHeight: 1.25,
          whiteSpace: 'pre-line',
          fontFamily: 'PingFang SC, sans-serif',
          opacity: intro,
          textShadow: '0 4px 20px rgba(0,0,0,0.6)',
        }}
      >
        {title}
      </div>

      {/* 参与者署名（标题下方，常驻，片尾前隐藏） */}
      {!inOutro ? (
        <div
          style={{
            position: 'absolute',
            top: 380,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.45)',
            border: `2px solid ${ACCENT}`,
            color: ACCENT,
            fontFamily: 'PingFang SC, sans-serif',
            fontWeight: 700,
            fontSize: 34,
            padding: '8px 28px',
            borderRadius: 40,
            whiteSpace: 'nowrap',
            opacity: intro,
          }}
        >
          {credit}
        </div>
      ) : null}

      {/* 卡拉OK逐字字幕（冷开场即出现，片尾前隐藏） */}
      {!inOutro ? <Karaoke words={words} brand={ACCENT} /> : null}

      {/* 海外版英文字幕：国际 Shorts 风格，1-2 词逐块跳字 */}
      {!inOutro && subsEn && subsEn.length ? <SubsEnPop subs={subsEn} brand={ACCENT} /> : null}

      {/* 片尾品牌卡 */}
      {inOutro ? (
        <AbsoluteFill
          style={{
            backgroundColor: `rgba(13,13,13,${0.92 * outroProgress})`,
            justifyContent: 'center',
            alignItems: 'center',
            opacity: outroProgress,
          }}
        >
          <Img
            src={staticFile('logo.png')}
            style={{
              width: 300,
              height: 300,
              borderRadius: 56,
              transform: `scale(${interpolate(logoPop, [0, 1], [0.7, 1])})`,
              boxShadow: `0 12px 50px ${ACCENT}59`,
            }}
          />
          <div
            style={{
              marginTop: 50,
              fontSize: 46,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.85)',
              fontFamily: 'PingFang SC, sans-serif',
              textAlign: 'center',
            }}
          >
            {BRAND.outro.question}
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 64,
              fontWeight: 900,
              color: '#fff',
              fontFamily: 'PingFang SC, sans-serif',
              textAlign: 'center',
            }}
          >
            {BRAND.outro.searchCta}
          </div>
          <div
            style={{
              marginTop: 26,
              fontSize: 38,
              color: ACCENT,
              fontWeight: 700,
              fontFamily: 'PingFang SC, sans-serif',
              border: `3px solid ${ACCENT}`,
              borderRadius: 50,
              padding: '14px 40px',
              textAlign: 'center',
            }}
          >
            {BRAND.outro.listenOn}
          </div>
          {BRAND.outro.website ? (
            <div
              style={{
                marginTop: 34,
                fontSize: 30,
                color: 'rgba(255,255,255,0.6)',
                fontFamily: 'sans-serif',
                letterSpacing: 1,
              }}
            >
              {BRAND.outro.website}
            </div>
          ) : null}

          {/* 打赏/赞赏二维码（可选，brand.sponsorImage 填了才显示） */}
          {BRAND.sponsorImage ? (
            <div style={{ marginTop: 34, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <Img src={staticFile(BRAND.sponsorImage)} style={{ width: 200, height: 200, borderRadius: 18, background: '#fff', padding: 8 }} />
              <div style={{ fontSize: 30, color: 'rgba(255,255,255,0.75)', fontFamily: 'PingFang SC, sans-serif' }}>
                {BRAND.sponsorLabel}
              </div>
            </div>
          ) : null}
        </AbsoluteFill>
      ) : null}

      {/* 开头封面卡：给视频第一帧一个完整封面（视频号等平台自动取作封面/海报） */}
      {inCard ? (
        <AbsoluteFill style={{ opacity: cardFade }}>
          {/* 模糊封面铺底 + 暗化 */}
          {coverSrc ? (
            <>
              <Img
                src={coverSrc.startsWith('http') ? coverSrc : staticFile(coverSrc)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(22px) brightness(0.4)' }}
              />
              <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(13,13,13,0.6) 0%, rgba(13,13,13,0.25) 45%, rgba(13,13,13,0.88) 100%)' }} />
            </>
          ) : <AbsoluteFill style={{ backgroundColor: BG }} />}

          {/* 顶部品牌条 */}
          <div style={{ position: 'absolute', top: 70, left: 60, right: 60, display: 'flex', alignItems: 'center', gap: 18 }}>
            <Img src={staticFile('logo.png')} style={{ width: 88, height: 88, borderRadius: 18 }} />
            <div style={{ fontFamily: 'PingFang SC, sans-serif', color: '#fff', fontWeight: 800, fontSize: 44 }}>
              {BRAND.name} {BRAND.tagline ? <span style={{ color: ACCENT }}>{BRAND.tagline}</span> : null}
            </div>
            <div style={{ marginLeft: 'auto', color: ACCENT, fontWeight: 700, fontSize: 40, fontFamily: 'PingFang SC, sans-serif' }}>{epLabel}</div>
          </div>

          {/* 参与者署名 */}
          <div style={{ position: 'absolute', top: 210, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.5)', border: `2px solid ${ACCENT}`, color: '#fff', fontFamily: 'PingFang SC, sans-serif', fontWeight: 700, fontSize: 40, padding: '12px 38px', borderRadius: 50, whiteSpace: 'nowrap' }}>
            {credit}
          </div>

          {/* 中部巨大钩子 */}
          <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 80px' }}>
            <div style={{ fontFamily: 'PingFang SC, sans-serif', fontWeight: 900, fontSize: 130, lineHeight: 1.16, color: '#fff', textAlign: 'center', textShadow: '0 8px 36px rgba(0,0,0,0.85)', WebkitTextStroke: '2px rgba(0,0,0,0.35)' }}>
              {renderHook(coverHook || title)}
            </div>
          </AbsoluteFill>

          {/* 底部引导条 */}
          <div style={{ position: 'absolute', bottom: 120, left: '50%', transform: 'translateX(-50%)', background: ACCENT, color: '#000', fontFamily: 'PingFang SC, sans-serif', fontWeight: 800, fontSize: 42, padding: '18px 52px', borderRadius: 50, whiteSpace: 'nowrap' }}>
            {BRAND.bottomCta}
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
