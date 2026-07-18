export interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  duration?: string;
}

export interface FfprobeFormat {
  duration?: string;
}

export interface FfprobeOutput {
  streams?: FfprobeStream[];
  format?: FfprobeFormat;
}

export interface VideoMetadata {
  durationMs: number | null;
  width: number | null;
  height: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
}

export const EMPTY_VIDEO_METADATA: VideoMetadata = {
  durationMs: null,
  width: null,
  height: null,
  videoCodec: null,
  audioCodec: null,
};

export function resolveFfprobePath(
  env: Record<string, string | undefined> = process.env
): string {
  return env.FFPROBE_PATH?.trim() || 'ffprobe';
}

export function buildFfprobeArgs(filePath: string): string[] {
  return ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', filePath];
}

export function parseFfprobeOutput(raw: string): VideoMetadata {
  let parsed: FfprobeOutput;
  try {
    parsed = JSON.parse(raw) as FfprobeOutput;
  } catch {
    return { ...EMPTY_VIDEO_METADATA };
  }

  const streams = parsed.streams ?? [];
  const videoStream = streams.find((s) => s.codec_type === 'video');
  const audioStream = streams.find((s) => s.codec_type === 'audio');

  const durationRaw = parsed.format?.duration ?? videoStream?.duration ?? null;
  const durationSec = durationRaw != null ? Number.parseFloat(durationRaw) : NaN;

  return {
    durationMs: Number.isFinite(durationSec) ? Math.round(durationSec * 1000) : null,
    width: videoStream?.width ?? null,
    height: videoStream?.height ?? null,
    videoCodec: videoStream?.codec_name ?? null,
    audioCodec: audioStream?.codec_name ?? null,
  };
}

export type Exec = (
  cmd: string,
  args: string[]
) => Promise<{ stdout: string; stderr?: string }>;

export async function probeVideo(filePath: string, exec: Exec): Promise<VideoMetadata> {
  const { stdout } = await exec(resolveFfprobePath(), buildFfprobeArgs(filePath));
  return parseFfprobeOutput(stdout);
}
