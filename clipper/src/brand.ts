// ============================================================================
//  品牌配置 —— 改这一个文件，就能把整套切片换成你的节目。
//  组件（PodcastClip / Cover）里所有文案、颜色、署名都从这里读。
// ============================================================================

export const BRAND = {
  // 主强调色（大字幕高亮、边框、CTA 底色）。换成你的品牌色。
  color: '#5b8cff',
  // 背景底色
  bg: '#0d0d0d',

  // 节目名（封面/封面卡的品牌条）
  name: 'Your Podcast',
  // 节目名后的小标签，如城市/副标题；不要就留空字符串
  tagline: '· City',

  // 默认主播名（build_spec.py 也有同名默认值 --host）
  defaultHost: 'Host',

  // 片尾品牌卡文案
  outro: {
    question: '完整一期去哪听？',          // 第一行提示
    searchCta: '搜「Your Podcast」',        // 第二行大字（引导搜索）
    listenOn: '🎧 小宇宙 · Apple Podcasts · Spotify', // 第三行收听渠道
    website: 'your-podcast.example.com',     // 第四行网址
  },

  // 竖屏视频底部 / 封面卡底部的引导条
  bottomCta: '▶ 完整一期搜「Your Podcast」',

  // ── 打赏/赞赏（可选）──────────────────────────────────────────────
  // 想在片尾卡放收款/赞赏二维码就把图片放到 public/ 并填文件名（相对 public/）。
  // 留空字符串 = 不显示。⚠️ 二维码属个人敏感信息，开源/公开仓库请勿提交真图，
  // 建议本地放、加进 .gitignore。
  sponsorImage: '',            // 例：'sponsor.png'
  sponsorLabel: '觉得有用，请我喝杯咖啡 ☕',
};
