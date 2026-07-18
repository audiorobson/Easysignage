import { describe, expect, it } from 'vitest';
import {
  buildFfprobeArgs,
  parseFfprobeOutput,
  probeVideo,
  resolveFfprobePath,
} from './ffprobe.js';

describe('resolveFfprobePath', () => {
  it('usa FFPROBE_PATH do ambiente quando definido', () => {
    expect(resolveFfprobePath({ FFPROBE_PATH: '/opt/ffmpeg/ffprobe' })).toBe(
      '/opt/ffmpeg/ffprobe'
    );
  });

  it('usa "ffprobe" (PATH) por omissão', () => {
    expect(resolveFfprobePath({})).toBe('ffprobe');
    expect(resolveFfprobePath({ FFPROBE_PATH: '  ' })).toBe('ffprobe');
  });
});

describe('buildFfprobeArgs', () => {
  it('inclui o caminho do ficheiro e pede JSON de format+streams', () => {
    const args = buildFfprobeArgs('/tmp/video.mp4');
    expect(args).toContain('/tmp/video.mp4');
    expect(args).toContain('-show_format');
    expect(args).toContain('-show_streams');
    expect(args).toContain('json');
  });
});

describe('parseFfprobeOutput', () => {
  it('extrai duração/dimensões/codecs de um output típico', () => {
    const raw = JSON.stringify({
      format: { duration: '12.345000' },
      streams: [
        { codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080 },
        { codec_type: 'audio', codec_name: 'aac' },
      ],
    });
    expect(parseFfprobeOutput(raw)).toEqual({
      durationMs: 12345,
      width: 1920,
      height: 1080,
      videoCodec: 'h264',
      audioCodec: 'aac',
    });
  });

  it('usa a duração do stream de vídeo quando o format não a informa', () => {
    const raw = JSON.stringify({
      format: {},
      streams: [{ codec_type: 'video', codec_name: 'vp9', duration: '2.0' }],
    });
    expect(parseFfprobeOutput(raw).durationMs).toBe(2000);
  });

  it('devolve tudo nulo para JSON inválido', () => {
    expect(parseFfprobeOutput('não é json')).toEqual({
      durationMs: null,
      width: null,
      height: null,
      videoCodec: null,
      audioCodec: null,
    });
  });

  it('devolve tudo nulo quando não há streams', () => {
    expect(parseFfprobeOutput(JSON.stringify({}))).toEqual({
      durationMs: null,
      width: null,
      height: null,
      videoCodec: null,
      audioCodec: null,
    });
  });
});

describe('probeVideo', () => {
  it('invoca o executor com o binário/args corretos e faz parse do stdout', async () => {
    const calls: Array<{ cmd: string; args: string[] }> = [];
    const exec = async (cmd: string, args: string[]) => {
      calls.push({ cmd, args });
      return {
        stdout: JSON.stringify({
          format: { duration: '5' },
          streams: [{ codec_type: 'video', codec_name: 'h264', width: 640, height: 480 }],
        }),
      };
    };

    const result = await probeVideo('/tmp/a.mp4', exec);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.cmd).toBe('ffprobe');
    expect(calls[0]?.args).toContain('/tmp/a.mp4');
    expect(result).toEqual({
      durationMs: 5000,
      width: 640,
      height: 480,
      videoCodec: 'h264',
      audioCodec: null,
    });
  });
});
