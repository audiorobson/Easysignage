/**
 * PR 5.16 — normalização de vídeo. Deteta ficheiros fora do formato
 * recomendado (MP4 contentor + H.264 vídeo + AAC áudio, ou sem áudio) e
 * define os argumentos `ffmpeg` para os re-codificar num MP4 compatível
 * com a maior parte dos players/hardware de TV comercial.
 */

export interface RecommendedFormatCheck {
  mimeType: string;
  videoCodec: string | null;
  audioCodec: string | null;
}

const RECOMMENDED_CONTAINER_MIME = 'video/mp4';
const RECOMMENDED_VIDEO_CODECS = new Set(['h264']);
const RECOMMENDED_AUDIO_CODECS = new Set(['aac']);

/**
 * `true` quando o vídeo precisa de ser recodificado: contentor diferente de
 * MP4, vídeo fora de H.264, ou áudio presente mas fora de AAC. Vídeo sem
 * faixa de áudio (`audioCodec === null`) é considerado válido.
 */
export function needsNormalization(check: RecommendedFormatCheck): boolean {
  if (check.mimeType !== RECOMMENDED_CONTAINER_MIME) return true;
  if (!check.videoCodec || !RECOMMENDED_VIDEO_CODECS.has(check.videoCodec)) return true;
  if (check.audioCodec && !RECOMMENDED_AUDIO_CODECS.has(check.audioCodec)) return true;
  return false;
}

/** Recodifica para H.264 (CRF 23, preset veryfast) + AAC 128k, com faststart para streaming. */
export function buildNormalizeArgs(inputPath: string, outputPath: string): string[] {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    inputPath,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '23',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-movflags',
    '+faststart',
    outputPath,
  ];
}
