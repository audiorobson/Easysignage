import { describe, expect, it } from 'vitest';
import { buildVideoThumbnailArgs, resolveFfmpegPath } from './video-thumbnail.js';

describe('resolveFfmpegPath', () => {
  it('usa FFMPEG_PATH do ambiente quando definido', () => {
    expect(resolveFfmpegPath({ FFMPEG_PATH: '/opt/ffmpeg/ffmpeg' })).toBe(
      '/opt/ffmpeg/ffmpeg'
    );
  });

  it('usa "ffmpeg" (PATH) por omissão', () => {
    expect(resolveFfmpegPath({})).toBe('ffmpeg');
  });
});

describe('buildVideoThumbnailArgs', () => {
  it('extrai um frame ~1s e redimensiona para 320px de largura', () => {
    const args = buildVideoThumbnailArgs('/tmp/in.mp4', '/tmp/out.jpg');
    expect(args).toContain('/tmp/in.mp4');
    expect(args).toContain('/tmp/out.jpg');
    expect(args).toContain('00:00:01');
    expect(args).toContain('scale=320:-2');
  });
});
