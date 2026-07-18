import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { buildRtspToFmp4Args, resolveFfmpegPath, spawnRtspToFmp4, type SpawnFn } from './ffmpeg-rtsp';

describe('resolveFfmpegPath', () => {
  const originalEnv = process.env.FFMPEG_PATH;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.FFMPEG_PATH;
    else process.env.FFMPEG_PATH = originalEnv;
  });

  it('usa "ffmpeg" do PATH quando FFMPEG_PATH não está definido', () => {
    delete process.env.FFMPEG_PATH;
    expect(resolveFfmpegPath()).toBe('ffmpeg');
  });

  it('usa FFMPEG_PATH quando definido (com trim)', () => {
    process.env.FFMPEG_PATH = '  /opt/ffmpeg/bin/ffmpeg  ';
    expect(resolveFfmpegPath()).toBe('/opt/ffmpeg/bin/ffmpeg');
  });
});

describe('buildRtspToFmp4Args', () => {
  it('inclui o URL RTSP, transporte TCP, remux para fMP4 streamable e descarta áudio', () => {
    const args = buildRtspToFmp4Args('rtsp://cam.local/stream1');

    expect(args).toContain('rtsp://cam.local/stream1');
    expect(args).toContain('-rtsp_transport');
    expect(args).toContain('tcp');
    expect(args).toContain('-an');
    expect(args).toContain('copy');
    expect(args).toContain('pipe:1');

    const movflagsIdx = args.indexOf('-movflags');
    expect(movflagsIdx).toBeGreaterThan(-1);
    expect(args[movflagsIdx + 1]).toContain('frag_keyframe');
    expect(args[movflagsIdx + 1]).toContain('empty_moov');
  });
});

describe('spawnRtspToFmp4', () => {
  beforeEach(() => {
    delete process.env.FFMPEG_PATH;
  });

  it('spawna o ffmpeg resolvido com os args de remux e stdio configurado', () => {
    const fakeChild = { stdout: {}, stderr: {} };
    const spawnFn = vi.fn().mockReturnValue(fakeChild);

    const result = spawnRtspToFmp4('rtsp://cam.local/stream1', spawnFn as unknown as SpawnFn);

    expect(spawnFn).toHaveBeenCalledTimes(1);
    const [bin, args, options] = spawnFn.mock.calls[0];
    expect(bin).toBe('ffmpeg');
    expect(args).toContain('rtsp://cam.local/stream1');
    expect(options).toMatchObject({ stdio: ['ignore', 'pipe', 'pipe'] });
    expect(result).toBe(fakeChild);
  });

  it('usa FFMPEG_PATH quando definido', () => {
    process.env.FFMPEG_PATH = '/custom/ffmpeg';
    const spawnFn = vi.fn().mockReturnValue({});

    spawnRtspToFmp4('rtsp://cam.local/stream1', spawnFn as unknown as SpawnFn);

    expect(spawnFn.mock.calls[0][0]).toBe('/custom/ffmpeg');
  });
});
