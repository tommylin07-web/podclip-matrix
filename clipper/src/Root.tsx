import { Composition, getInputProps } from 'remotion';
import { PodcastClip, clipSchema, type ClipProps } from './PodcastClip';
import { Cover, coverSchema } from './Cover';
import { BRAND } from './brand';

const FPS = 30;

// 没传 --props 时的占位预览（在 Remotion Studio 里能直接看到效果）
const fallback: ClipProps = {
  epLabel: 'EP01 · Demo',
  title: '一句抓人的\n标题在这里',
  hook: '"放一句最有钩子的话"',
  coverSrc: '',
  audioSrc: '',
  audioStartSec: 0,
  durationSec: 12,
  words: [
    { t: 0.2, d: 0.4, w: '这' },
    { t: 0.6, d: 0.4, w: '是' },
    { t: 1.0, d: 0.6, w: '逐字' },
    { t: 1.6, d: 0.8, w: '字幕' },
    { t: 2.4, d: 0.8, w: '示例' },
  ],
  sfx: [],
};

export const RemotionRoot: React.FC = () => {
  // 渲染时通过 --props 传入；用 input props 的 durationSec 决定帧数
  const input = getInputProps() as Partial<ClipProps>;
  const durationSec = input.durationSec ?? fallback.durationSec;

  return (
    <>
      <Composition
        id="PodcastClip"
        component={PodcastClip}
        durationInFrames={Math.round(durationSec * FPS)}
        fps={FPS}
        width={1080}
        height={1920}
        schema={clipSchema}
        defaultProps={fallback}
      />
      <Composition
        id="Cover"
        component={Cover}
        durationInFrames={1}
        fps={FPS}
        width={1080}
        height={1440}
        schema={coverSchema}
        defaultProps={{
          epLabel: 'EP01',
          coverHook: '把最大的||钩子||\n放在这里',
          coverSrc: '',
        }}
      />
    </>
  );
};

// 防止某些打包器把 BRAND 摇树掉（仅引用一下）
void BRAND.name;
