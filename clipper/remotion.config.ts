import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setConcurrency(1); // 低内存机器限并发避免 OOM；内存大可调高或删掉这行
Config.setChromiumOpenGlRenderer('angle');
