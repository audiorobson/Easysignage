export function resolveFfmpegPath(
  env: Record<string, string | undefined> = process.env
): string {
  return env.FFMPEG_PATH?.trim() || 'ffmpeg';
}

/** Frame ~1s do vídeo, redimensionado (largura 320px, altura proporcional). */
export function buildVideoThumbnailArgs(inputPath: string, outputPath: string): string[] {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    inputPath,
    '-ss',
    '00:00:01',
    '-vframes',
    '1',
    '-vf',
    'scale=320:-2',
    outputPath,
  ];
}
