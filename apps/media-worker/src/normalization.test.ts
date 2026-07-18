import { describe, expect, it } from 'vitest';
import { buildNormalizeArgs, needsNormalization } from './normalization.js';

describe('needsNormalization', () => {
  it('não normaliza MP4/H.264/AAC (formato recomendado)', () => {
    expect(
      needsNormalization({ mimeType: 'video/mp4', videoCodec: 'h264', audioCodec: 'aac' })
    ).toBe(false);
  });

  it('não normaliza MP4/H.264 sem faixa de áudio', () => {
    expect(
      needsNormalization({ mimeType: 'video/mp4', videoCodec: 'h264', audioCodec: null })
    ).toBe(false);
  });

  it('normaliza contentores diferentes de MP4 (webm, mov, avi, mkv)', () => {
    for (const mimeType of ['video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska']) {
      expect(needsNormalization({ mimeType, videoCodec: 'h264', audioCodec: 'aac' })).toBe(true);
    }
  });

  it('normaliza codecs de vídeo fora de H.264 (vp9, hevc, av1)', () => {
    for (const videoCodec of ['vp9', 'hevc', 'av1', 'mpeg4']) {
      expect(
        needsNormalization({ mimeType: 'video/mp4', videoCodec, audioCodec: 'aac' })
      ).toBe(true);
    }
  });

  it('normaliza codecs de áudio fora de AAC (mp3, opus, vorbis, ac3)', () => {
    for (const audioCodec of ['mp3', 'opus', 'vorbis', 'ac3']) {
      expect(
        needsNormalization({ mimeType: 'video/mp4', videoCodec: 'h264', audioCodec })
      ).toBe(true);
    }
  });

  it('normaliza quando o codec de vídeo é desconhecido (probe falhou)', () => {
    expect(
      needsNormalization({ mimeType: 'video/mp4', videoCodec: null, audioCodec: null })
    ).toBe(true);
  });
});

describe('buildNormalizeArgs', () => {
  it('recodifica para H.264/AAC com faststart', () => {
    const args = buildNormalizeArgs('/tmp/in.webm', '/tmp/out.mp4');
    expect(args).toContain('/tmp/in.webm');
    expect(args).toContain('/tmp/out.mp4');
    expect(args).toContain('libx264');
    expect(args).toContain('aac');
    expect(args).toContain('+faststart');
  });
});
